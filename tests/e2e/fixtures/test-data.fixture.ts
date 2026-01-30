import { test as authTest, type TestUser, TEST_USERS } from './auth.fixture';

export interface TestEvent {
	id: string;
	orgSlug: string;
	slug: string;
	name: string;
	requiresTicket: boolean;
	potluckOpen: boolean;
}

export interface TestOrganization {
	id: string;
	slug: string;
	name: string;
}

// Known test data from backend seed
// Note: These values need to match actual seed data from the backend
export const TEST_DATA = {
	organizations: {
		testOrg: {
			id: 'test-org-id',
			slug: 'test-org',
			name: 'Test Organization'
		}
	},
	events: {
		publicFreeEvent: {
			id: 'public-free-event-id',
			orgSlug: 'test-org',
			slug: 'public-free-event',
			name: 'Public Free Event',
			requiresTicket: false,
			potluckOpen: true
		},
		ticketedEvent: {
			id: 'ticketed-event-id',
			orgSlug: 'test-org',
			slug: 'ticketed-event',
			name: 'Ticketed Event',
			requiresTicket: true,
			potluckOpen: false
		},
		membersOnlyEvent: {
			id: 'members-only-event-id',
			orgSlug: 'test-org',
			slug: 'members-only-event',
			name: 'Members Only Event',
			requiresTicket: false,
			potluckOpen: false
		}
	}
};

export type TestDataFixtures = {
	testData: typeof TEST_DATA;
	getEvent: (key: keyof typeof TEST_DATA.events) => TestEvent;
	getOrg: (key: keyof typeof TEST_DATA.organizations) => TestOrganization;
};

export const test = authTest.extend<TestDataFixtures>({
	testData: async (_, use) => {
		await use(TEST_DATA);
	},

	getEvent: async (_, use) => {
		await use((key) => TEST_DATA.events[key]);
	},

	getOrg: async (_, use) => {
		await use((key) => TEST_DATA.organizations[key]);
	}
});

export { expect } from '@playwright/test';
export { TEST_USERS, type TestUser };
