import { useLoaderData } from 'react-router';
import { authenticate } from '../shopify.server';
import { getSettingsMockData } from '../data/mock-dashboard.server';
import { SettingsForm } from '../components/dashboard/SettingsForm.jsx';

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return getSettingsMockData();
};

export default function Settings() {
  const data = useLoaderData();
  return (
    <s-page heading="Settings">
      <SettingsForm {...data} />
    </s-page>
  );
}
