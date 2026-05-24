import type {RegisteredDashboard} from './dashboards_module';

import keytarAndFootDashboard from './keytar_and_foot_dashboard/keytar_and_foot_dashboard';

export default [
    {
        dashboard: keytarAndFootDashboard,
        id: 'keytar_and_foot_dashboard',
        label: 'Keytar and Foot dashboard',
    },
] as RegisteredDashboard[];
