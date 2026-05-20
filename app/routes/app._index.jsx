import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

const EXTENSION_UUID = "770e3d9e-3fe9-98c2-0c3d-fe71ee70a7db5cc97b39";
const BLOCK_NAME = "chat-interface";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const themeEditorUrl = `https://${session.shop}/admin/themes/current/editor?context=apps&activateAppId=${EXTENSION_UUID}/${BLOCK_NAME}`;
  return { themeEditorUrl };
};

export default function Index() {
  const { themeEditorUrl } = useLoaderData();

  return (
    <s-page>
      <ui-title-bar title="Shop chat agent reference app" />

      <s-section>
        <s-stack gap="base">
          <s-heading>Congrats on creating a new Shopify app 🎉</s-heading>
          <s-paragraph>
            This is a reference app that adds a chat agent on your storefront,
            which is powered via claude and can connect shopify mcp platform.
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section heading="App template specs" slot="aside">
        <s-paragraph>
          <s-text>Framework: </s-text>
          <s-link href="https://reactrouter.com/" target="_blank">
            React Router
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>Interface: </s-text>
          <s-link
            href="https://shopify.dev/docs/api/app-home/using-polaris-components"
            target="_blank"
          >
            Polaris web components
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>API: </s-text>
          <s-link
            href="https://shopify.dev/docs/api/admin-graphql"
            target="_blank"
          >
            GraphQL
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>Database: </s-text>
          <s-link href="https://www.prisma.io/" target="_blank">
            Prisma
          </s-link>
        </s-paragraph>
      </s-section>

      <s-section heading="Next steps" slot="aside">
        <s-stack gap="base">
          <s-paragraph>
            The chat widget is a theme app block. After installing the app, you
            must add the block to your active theme so it appears on the
            storefront.
          </s-paragraph>
          <s-link href={themeEditorUrl} target="_blank">
            Enable chat widget in Theme Editor →
          </s-link>
        </s-stack>
      </s-section>
    </s-page>
  );
}
