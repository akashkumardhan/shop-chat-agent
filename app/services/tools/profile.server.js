/**
 * Customer profile tools — view + mutate via Admin API.
 *
 * Path B Hybrid: the authenticated customer's identity comes from the JWT
 * `sub` claim (Customer-MCP OAuth token); all reads and writes flow through
 * the Admin API server-side, scoped to that customer ID.
 *
 * Operations:
 *   - get_my_profile     → Admin customer(id:)
 *   - update_my_profile  → Admin customerUpdate
 *   - add_my_address     → Admin customerAddressCreate
 *   - update_my_address  → Admin customerAddressUpdate
 *   - delete_my_address  → Admin customerAddressDelete
 *
 * Required Admin scopes: read_customers, write_customers
 */
import { adminGraphQL } from "../admin-graphql.server";
import { requireCustomer } from "../customer-identity.server";

// ---------- get_my_profile ----------

const GET_PROFILE_QUERY = /* GraphQL */ `
  query GetMyProfile($id: ID!) {
    customer(id: $id) {
      id
      firstName
      lastName
      displayName
      email
      phone
      acceptsMarketing
      defaultAddress {
        id
        address1
        address2
        city
        province
        zip
        country
        phone
      }
      addresses(first: 10) {
        id
        address1
        address2
        city
        province
        zip
        country
        phone
      }
    }
  }
`;

export async function getMyProfile(ctx) {
  const { conversationId, shop } = ctx;
  if (!shop) return { error: "shop context missing" };

  const cust = await requireCustomer(conversationId);
  if (cust._authRequired) return { _authRequired: true };

  let data;
  try {
    data = await adminGraphQL(shop, GET_PROFILE_QUERY, { id: cust.customerGid });
  } catch (e) {
    return { error: e.message };
  }

  const c = data?.customer;
  if (!c) return { error: "Could not load your profile." };

  return {
    id: c.id,
    firstName: c.firstName || null,
    lastName: c.lastName || null,
    displayName: c.displayName || null,
    email: c.email || null,
    phone: c.phone || null,
    acceptsMarketing: c.acceptsMarketing,
    defaultAddress: c.defaultAddress
      ? {
          id: c.defaultAddress.id,
          line1: c.defaultAddress.address1,
          line2: c.defaultAddress.address2,
          city: c.defaultAddress.city,
          state: c.defaultAddress.province,
          postalCode: c.defaultAddress.zip,
          country: c.defaultAddress.country,
          phone: c.defaultAddress.phone,
        }
      : null,
    addresses: (c.addresses || []).map((a) => ({
      id: a.id,
      line1: a.address1,
      line2: a.address2,
      city: a.city,
      state: a.province,
      postalCode: a.zip,
      country: a.country,
      phone: a.phone,
    })),
  };
}

// ---------- update_my_profile ----------

const CUSTOMER_UPDATE_MUTATION = /* GraphQL */ `
  mutation CustomerUpdate($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer { id firstName lastName email phone }
      userErrors { field message }
    }
  }
`;

export async function updateMyProfile(ctx, args = {}) {
  const cust = await requireCustomer(ctx.conversationId);
  if (cust._authRequired) return { _authRequired: true };
  if (!ctx.shop) return { error: "shop context missing" };

  const input = { id: cust.customerGid };
  let changed = false;
  for (const k of ["firstName", "lastName", "email", "phone"]) {
    if (args[k] !== undefined && args[k] !== null) {
      input[k] = args[k];
      changed = true;
    }
  }
  if (!changed) {
    return { error: "Nothing to update — pass firstName, lastName, email, and/or phone." };
  }

  let data;
  try {
    data = await adminGraphQL(ctx.shop, CUSTOMER_UPDATE_MUTATION, { input });
  } catch (e) {
    return { error: e.message };
  }

  const errs = data?.customerUpdate?.userErrors || [];
  if (errs.length) return { error: errs.map((e) => e.message).join("; ") };

  return {
    updated: true,
    customer: data?.customerUpdate?.customer,
    message: "Your profile has been updated.",
  };
}

// ---------- add_my_address ----------

const ADDRESS_FIELDS = /* GraphQL */ `
  id
  address1
  address2
  city
  province
  zip
  country
  phone
`;

const ADDRESS_CREATE_MUTATION = /* GraphQL */ `
  mutation CustomerAddressCreate(
    $customerId: ID!
    $address: MailingAddressInput!
    $setAsDefault: Boolean
  ) {
    customerAddressCreate(
      customerId: $customerId
      address: $address
      setAsDefault: $setAsDefault
    ) {
      address { ${ADDRESS_FIELDS} }
      userErrors { field message }
    }
  }
`;

export async function addMyAddress(ctx, args = {}) {
  const cust = await requireCustomer(ctx.conversationId);
  if (cust._authRequired) return { _authRequired: true };
  if (!ctx.shop) return { error: "shop context missing" };

  const required = ["address1", "city", "country"];
  for (const r of required) {
    if (!args[r]) return { error: `Field '${r}' is required to add an address.` };
  }

  const address = {
    address1: args.address1,
    address2: args.address2 || undefined,
    city: args.city,
    province: args.state || args.province || undefined,
    zip: args.postalCode || args.zip || undefined,
    country: args.country,
    phone: args.phone || undefined,
    firstName: args.firstName || undefined,
    lastName: args.lastName || undefined,
  };

  let data;
  try {
    data = await adminGraphQL(ctx.shop, ADDRESS_CREATE_MUTATION, {
      customerId: cust.customerGid,
      address,
      setAsDefault: !!args.setAsDefault,
    });
  } catch (e) {
    return { error: e.message };
  }

  const errs = data?.customerAddressCreate?.userErrors || [];
  if (errs.length) return { error: errs.map((e) => e.message).join("; ") };

  return {
    created: true,
    address: data?.customerAddressCreate?.address,
    message: "Address added to your account.",
  };
}

// ---------- update_my_address ----------

const ADDRESS_UPDATE_MUTATION = /* GraphQL */ `
  mutation CustomerAddressUpdate(
    $customerId: ID!
    $addressId: ID!
    $address: MailingAddressInput!
    $setAsDefault: Boolean
  ) {
    customerAddressUpdate(
      customerId: $customerId
      addressId: $addressId
      address: $address
      setAsDefault: $setAsDefault
    ) {
      address { ${ADDRESS_FIELDS} }
      userErrors { field message }
    }
  }
`;

export async function updateMyAddress(ctx, args = {}) {
  const cust = await requireCustomer(ctx.conversationId);
  if (cust._authRequired) return { _authRequired: true };
  if (!ctx.shop) return { error: "shop context missing" };
  if (!args.addressId) return { error: "addressId is required" };

  const address = {};
  const map = {
    address1: "address1",
    address2: "address2",
    city: "city",
    state: "province",
    province: "province",
    postalCode: "zip",
    zip: "zip",
    country: "country",
    phone: "phone",
    firstName: "firstName",
    lastName: "lastName",
  };
  for (const [k, v] of Object.entries(map)) {
    if (args[k] !== undefined && args[k] !== null) address[v] = args[k];
  }

  let data;
  try {
    data = await adminGraphQL(ctx.shop, ADDRESS_UPDATE_MUTATION, {
      customerId: cust.customerGid,
      addressId: args.addressId,
      address,
      setAsDefault: !!args.setAsDefault,
    });
  } catch (e) {
    return { error: e.message };
  }

  const errs = data?.customerAddressUpdate?.userErrors || [];
  if (errs.length) return { error: errs.map((e) => e.message).join("; ") };

  return {
    updated: true,
    address: data?.customerAddressUpdate?.address,
    message: "Address updated.",
  };
}

// ---------- delete_my_address ----------

const ADDRESS_DELETE_MUTATION = /* GraphQL */ `
  mutation CustomerAddressDelete($customerId: ID!, $addressId: ID!) {
    customerAddressDelete(customerId: $customerId, addressId: $addressId) {
      deletedAddressId
      userErrors { field message }
    }
  }
`;

export async function deleteMyAddress(ctx, args = {}) {
  const cust = await requireCustomer(ctx.conversationId);
  if (cust._authRequired) return { _authRequired: true };
  if (!ctx.shop) return { error: "shop context missing" };
  if (!args.addressId) return { error: "addressId is required" };

  let data;
  try {
    data = await adminGraphQL(ctx.shop, ADDRESS_DELETE_MUTATION, {
      customerId: cust.customerGid,
      addressId: args.addressId,
    });
  } catch (e) {
    return { error: e.message };
  }

  const errs = data?.customerAddressDelete?.userErrors || [];
  if (errs.length) return { error: errs.map((e) => e.message).join("; ") };

  return {
    deleted: true,
    addressId: data?.customerAddressDelete?.deletedAddressId,
    message: "Address removed from your account.",
  };
}

// ---------- tool definitions ----------

export const profileToolDefinitions = [
  {
    name: "get_my_profile",
    description:
      "Fetch the signed-in customer's profile: name, email, phone, default and saved addresses, marketing preferences. Use this whenever the shopper asks about their account details. Requires customer authentication.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "update_my_profile",
    description:
      "Update the signed-in customer's profile (first name, last name, email, phone). Always confirm with the shopper before calling. Pass only the fields the shopper wants changed. Requires customer authentication.",
    input_schema: {
      type: "object",
      properties: {
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string", description: "Email address (E.164 / RFC 5321 format)." },
        phone: { type: "string", description: "Phone number in E.164 format, e.g. +15551234567." },
      },
    },
  },
  {
    name: "add_my_address",
    description:
      "Add a new shipping/billing address to the signed-in customer's account. Confirm address details with the shopper before calling. Set setAsDefault: true to make it the default address.",
    input_schema: {
      type: "object",
      properties: {
        address1: { type: "string" },
        address2: { type: "string" },
        city: { type: "string" },
        state: { type: "string", description: "State / province" },
        postalCode: { type: "string", description: "Postal / ZIP code" },
        country: { type: "string", description: "Two-letter country code (e.g. 'US', 'CA') or full country name." },
        phone: { type: "string" },
        firstName: { type: "string" },
        lastName: { type: "string" },
        setAsDefault: { type: "boolean" },
      },
      required: ["address1", "city", "country"],
    },
  },
  {
    name: "update_my_address",
    description:
      "Update one of the signed-in customer's saved addresses. Pass only the fields the shopper wants to change. Use get_my_profile to find the addressId.",
    input_schema: {
      type: "object",
      properties: {
        addressId: { type: "string", description: "Address GID from get_my_profile." },
        address1: { type: "string" },
        address2: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        postalCode: { type: "string" },
        country: { type: "string" },
        phone: { type: "string" },
        firstName: { type: "string" },
        lastName: { type: "string" },
        setAsDefault: { type: "boolean" },
      },
      required: ["addressId"],
    },
  },
  {
    name: "delete_my_address",
    description:
      "Delete one of the signed-in customer's saved addresses. Confirm with the shopper before calling. Use get_my_profile to find the addressId.",
    input_schema: {
      type: "object",
      properties: {
        addressId: { type: "string", description: "Address GID from get_my_profile." },
      },
      required: ["addressId"],
    },
  },
];
