# Revel Backend v1.0.0 - Release Notes

**Release Date:** 2025-11-19
**Status:** First Release

---

## 🎉 Overview

Revel v1.0.0 marks the first major release of an open-source, community-focused event management platform built with privacy, autonomy, and transparency at its core. Initially designed to serve queer, LGBTQ+, and sex-positive communities, Revel is a fully event-agnostic platform that can be self-hosted to give you complete control over your data and eliminate platform commissions.

This release combines the ticketing power of Eventbrite with the community-building tools of Meetup, all under a privacy-minded, open-source framework powered by Django 5.2+, Django Ninja, and PostgreSQL.

**[Learn more about Revel's capabilities →](/learn-more)**

---

## 🚀 Key Features

### Community & Membership Management

#### Organizations
- **Create and Manage Communities**: Establish your organization as a central hub for your community
- **Flexible Visibility**: Control organization visibility (Public, Members-Only)
- **Roles & Permissions**: Comprehensive permission system with Owner, Staff, and Member roles
- **Membership Tiers**: Create tiered membership levels with different access rights
- **Token-Based Invitations**: Generate shareable invitation links for member recruitment
- **Staff Management**: Assign granular permissions to staff members
- **Membership Requests**: Review and approve/reject membership applications
- **Organization Resources**: Attach documents, links, and files to organizations
- **Rich Media Support**: Upload logos and cover art for branding
- **Stripe Connect Integration**: Connect Stripe accounts for payment processing

### Event Management

#### Core Event Features
- **Single & Series Events**: Create standalone events or recurring event series
- **Comprehensive Event Details**: Rich descriptions, locations (with geo-coordinates), times, and settings
- **Event Status Management**: Draft, Published, Cancelled, and Completed statuses
- **Visibility Controls**: Public, Members-Only, or Invite-Only events
- **Event Tokens**: Generate shareable links for event visibility and invitations
- **Guest Access**: Allow attendance without login for open events
- **Event Resources**: Attach supplementary materials to events
- **Waitlist Management**: Enable and manage event waitlists when capacity is reached
- **Dietary Summary**: View aggregated dietary restrictions/preferences for meal planning
- **Attendee Lists**: View confirmed attendees with configurable visibility

#### Ticketing System
- **Multiple Ticket Tiers**: Create various ticket types with different pricing and privileges
- **Pricing Strategies**:
  - Fixed price tickets
  - Free tickets
  - Pay-What-You-Can (PWYC) with optional min/max bounds
- **Payment Methods**:
  - Online payment via Stripe
  - Offline payment
  - At-the-door payment
  - Free tickets
- **Ticket Tier Features**:
  - Per-tier capacity limits
  - Sales windows (sales_start_at/sales_end_at)
  - Tier-specific visibility settings
  - Membership tier restrictions
- **QR Code Check-In**: Scan and validate tickets at event entry
- **Admin Ticket Management**:
  - Confirm offline/at-door payments
  - Mark tickets as refunded
  - Cancel tickets with automatic capacity restoration
- **Stripe Integration**: Automated payment processing and refund handling via webhooks

#### RSVP System
- **RSVP Responses**: Support for Yes, No, Maybe responses
- **RSVP Management**: Admin interface for viewing and managing RSVPs
- **RSVP Deadlines**: Configure when RSVPs close
- **Guest RSVP**: Allow RSVPs without login with email confirmation

#### Invitations
- **Direct Invitations**: Invite specific users by email
- **Pending Invitations**: Track invitations sent to unregistered users
- **Token-Based Invitations**: Generate shareable invitation links with:
  - Usage limits
  - Expiration dates
  - Ticket tier assignment
  - Custom metadata
- **Invitation Requests**: Users can request invitations to private events
- **Invitation Privileges**: Grant special access (waive questionnaires, capacity exemptions)

### Advanced Attendee Screening

#### Questionnaire System
- **Dynamic Questionnaires**: Build custom questionnaires with sections and questions
- **Question Types**:
  - Multiple choice (single/multi-select)
  - Free text responses
- **Scoring & Evaluation**:
  - Automatic scoring with minimum thresholds
  - LLM-powered evaluation for free-text answers
  - Manual review workflow
  - Hybrid automatic + manual review mode
- **Questionnaire Features**:
  - Question and section shuffling
  - Retake policies with configurable cooldown periods
  - Attempt limits
  - Submission age limits
  - Custom LLM evaluation guidelines
- **Event & Series Assignment**: Attach questionnaires to specific events or entire series
- **Submission Management**: Review, approve, and reject submissions with admin interface
- **Types**: Support for Admission, Membership, Feedback, and Generic questionnaires

### Potluck Coordination
- **Item Management**: Create and manage list of items needed for potlucks
- **Item Assignment**: Attendees can claim specific items to bring
- **Item Status**: Track what's assigned vs. available
- **Quantity Tracking**: Specify quantities needed for each item
- **Admin Controls**: Organizers can add, edit, and remove potluck items

### User Account Management

#### Authentication
- **Email/Password Authentication**: Standard login with secure password handling
- **Google SSO**: Sign in via Google OAuth integration
- **Two-Factor Authentication (2FA)**: TOTP-based 2FA with authenticator apps
- **Password Reset**: Secure password recovery flow
- **Email Verification**: Required email verification for new accounts

#### User Profile
- **Personal Information**: Name, email, preferred name support
- **Location Preferences**: Set preferred city for distance-based event sorting
- **Dietary Preferences & Restrictions**:
  - Public/private dietary restrictions with restriction types (allergy, intolerance, preference)
  - System-managed dietary preferences (vegetarian, vegan, etc.)
  - Custom notes for both restrictions and preferences
- **Profile Updates**: Manage personal information and preferences

#### Privacy & Data Control (GDPR Compliant)
- **Data Export**: Request complete data export in machine-readable format
- **Account Deletion**: Two-step account deletion with email confirmation
- **Data Ownership**: Full control over your personal information

### Notification System

#### Multi-Channel Notifications
- **In-App Notifications**: Real-time notification center with read/unread tracking
- **Email Notifications**: Comprehensive email notification system
- **Telegram Integration**: Optional Telegram bot notifications (prototype)

#### Notification Types
- **Event Notifications**:
  - Event created/updated/cancelled
  - Event reminder before start
  - Event opened (when status changes to published)
- **RSVP Notifications**:
  - RSVP confirmed
  - RSVP status changed
- **Ticket Notifications**:
  - Ticket purchased/confirmed
  - Ticket cancelled/refunded
  - Payment successful/failed
- **Invitation Notifications**:
  - Event invitation received
  - Invitation request approved/rejected
- **Questionnaire Notifications**:
  - Questionnaire submission received
  - Evaluation result (approved/rejected)
- **Potluck Notifications**:
  - Item assignment confirmed
  - Dietary summary available
- **Organization Notifications**:
  - Membership approved/rejected
  - Organization announcement
- **System Notifications**:
  - Malware detected in uploaded files

#### Notification Preferences
- **Granular Controls**: Enable/disable notifications per type and per channel
- **Channel Management**: Toggle email, in-app, and Telegram channels independently
- **Unsubscribe Support**: One-click unsubscribe from emails with token-based preference updates
- **Default Settings**: Sensible defaults with full user customization

### Dashboard & Discovery

#### User Dashboard
- **My Organizations**: View organizations by relationship (owner/staff/member/pending)
- **My Events**: Filter events by relationship (organizing/attending/invited/requested)
- **My Event Series**: Track recurring event series you're involved with
- **My Invitations**: View all event invitations with past/upcoming filters
- **My Tickets**: Browse all tickets with status and payment method filters
- **My RSVPs**: Track RSVP history across events
- **Invitation Requests**: Monitor status of your invitation requests

#### Discovery & Search
- **Event Discovery**:
  - Browse public and accessible events
  - Full-text search across event names, descriptions, and tags
  - Filter by organization, series, tags, and date ranges
  - Distance-based sorting using user location
  - Include/exclude past events
- **Organization Discovery**:
  - Browse organizations with visibility filters
  - Search by name, description, and tags
  - Distance and alphabetical sorting
- **Event Series Discovery**:
  - Find recurring event collections
  - Filter by organization
  - Full-text search support
- **Tag System**: Categorize and discover events, organizations, and series via tags

### Geolocation Features
- **City Database**: Comprehensive world cities database with coordinates
- **IP Geolocation**: Automatic location detection via IP2Location
- **Distance Calculations**: Calculate distances between events and user locations
- **Country Support**: Browse cities by country
- **City Search**: Autocomplete-enabled city search for location selection

### Additional Resources
- **File Uploads**: Attach documents, images, and media to organizations, events, and series
- **Link Resources**: Add web links as resources
- **Visibility Controls**: Public or restricted access for resources
- **Organization Page Display**: Choose which resources appear on organization pages
- **Malware Scanning**: Automatic ClamAV scanning for uploaded files with quarantine

---

## 🏗️ Technical Architecture

### Backend Framework
- **Django 5.2+**: Modern Python web framework
- **Django Ninja**: Fast, type-safe API framework with automatic OpenAPI documentation
- **Django Ninja Extra**: Controller-based architecture with decorators
- **PostgreSQL 15+**: Robust relational database
- **PostGIS**: Geographic extensions for location features
- **Python 3.13+**: Latest Python features and performance improvements

### API Design
- **RESTful Architecture**: Clean, predictable API endpoints
- **Automatic OpenAPI Documentation**: Interactive Swagger UI at `/api/docs`
- **Type Safety**: Full type hints with mypy strict mode
- **Rate Limiting**: Configurable throttling for all endpoints
- **Pagination**: Cursor and page-based pagination support
- **Search**: Full-text search across resources
- **Filtering**: Advanced filtering with django-filter integration
- **Authentication**: JWT-based authentication with refresh tokens
- **Optional Authentication**: Support for public/private endpoint variants
- **Permission System**: Granular role-based access control

### Background Processing
- **Celery**: Distributed task queue for async operations
- **Redis**: Message broker and cache backend
- **Celery Beat**: Scheduled periodic tasks
- **Flower**: Celery monitoring UI (development)

### Security Features
- **JWT Authentication**: Secure token-based authentication
- **2FA Support**: TOTP-based two-factor authentication
- **File Malware Scanning**: ClamAV integration for uploaded files
- **GDPR Compliance**: Data export and deletion capabilities
- **Rate Limiting**: DDoS protection via throttling
- **Secure File Handling**: Quarantine system for suspicious uploads
- **Email Verification**: Required email confirmation
- **Password Security**: Django's robust password hashing

### Observability (LGTM Stack)
- **Structured Logging**: JSON logs with automatic context (request_id, user_id, task_id)
- **Distributed Tracing**: Automatic tracing of HTTP, database, Redis, and Celery operations
- **Metrics Collection**: Django, PostgreSQL, Redis, and Celery metrics
- **Flamegraphs**: Continuous profiling with Pyroscope
- **PII Scrubbing**: Automatic redaction of sensitive data
- **Grafana Dashboards**: Unified visualization for logs, traces, metrics, and profiles
- **Grafana Alerting**: Production-ready alerts (errors, payments, auth failures)
- **Services**:
  - Loki (log aggregation)
  - Tempo (distributed tracing)
  - Mimir/Prometheus (metrics)
  - Pyroscope (continuous profiling)
  - Grafana (unified dashboard)

### Development Tools
- **UV**: Fast Python package manager (replaces pip)
- **Ruff**: Lightning-fast linting and formatting
- **mypy**: Strict static type checking
- **pytest**: Comprehensive test suite with coverage reporting
- **Docker**: Containerized development environment
- **docker-compose**: Multi-service orchestration
- **Makefile**: Streamlined development commands

### Code Quality Standards
- **100% Type Coverage**: Strict mypy enforcement
- **Google-Style Docstrings**: Comprehensive API documentation
- **DRY/KISS/SOLID**: Clean architecture principles
- **Test Coverage**: High coverage with integration tests
- **Code Formatting**: Automated via ruff
- **Factory-Based Test Data**: Consistent test data generation

### Storage & External Services
- **MinIO**: S3-compatible object storage for development
- **Configurable Storage**: Support for local and S3-compatible storage
- **Stripe Integration**: Payment processing and webhooks
- **IP2Location**: Geolocation database
- **ClamAV**: Malware scanning for uploads

---

## 📊 API Statistics

### Controller Breakdown

#### Account Management (3 controllers, 20+ endpoints)
- **Account Controller**: Registration, verification, profile, GDPR operations
- **Auth Controller**: Login, Google SSO, 2FA token exchange
- **OTP Controller**: 2FA setup, activation, deactivation
- **Dietary Controller**: Food items, restrictions, preferences management

#### Event Management (6 controllers, 100+ endpoints)
- **Event Controller**: Event discovery, detail, RSVP, ticketing, waitlist, guest access
- **Event Admin Controller**: Token management, invitations, tickets, RSVPs, check-in, resources
- **Event Series Controller**: Series discovery, detail, resources
- **Event Series Admin Controller**: Series management (placeholder)
- **Potluck Controller**: Item management, claiming/unclaiming
- **Questionnaire Controller**: CRUD operations, submissions, evaluations, assignments

#### Organization Management (2 controllers, 50+ endpoints)
- **Organization Controller**: Discovery, detail, resources, membership requests, tokens
- **Organization Admin Controller**: Full CRUD, members, staff, tiers, tokens, resources, Stripe

#### User Features (2 controllers, 15+ endpoints)
- **Dashboard Controller**: Personalized views for organizations, events, series, invitations, tickets, RSVPs
- **User Preferences Controller**: Global user settings

#### Notifications (2 controllers, 10+ endpoints)
- **Notification Controller**: List, mark read/unread, unread count
- **Notification Preference Controller**: Channel and type preferences, unsubscribe

#### Utility (2 controllers, 5+ endpoints)
- **City Controller**: City search, countries list
- **Tag Controller**: Tag discovery and search

#### Webhooks (1 controller)
- **Stripe Webhook Controller**: Payment and refund event handling

**Total:** 18 controllers, 200+ API endpoints

---

## 🧪 Testing & Quality

### Test Coverage
- **Comprehensive Test Suite**: pytest-based testing framework
- **Factory-Based Fixtures**: Consistent test data generation
- **Integration Tests**: End-to-end workflow testing
- **Unit Tests**: Business logic validation
- **Celery Task Testing**: Async operation verification
- **Coverage Reporting**: HTML coverage reports
- **CI Integration**: Automated testing in GitHub Actions

### Development Workflow
- **Pre-commit Checks**: `make check` runs format, lint, mypy, i18n checks
- **Type Safety**: mypy strict mode enforcement
- **Code Formatting**: Automatic via ruff
- **Makefile Commands**: Streamlined development tasks
- **Docker Development**: Consistent environment via docker-compose

---

## 🌍 Internationalization

### Supported Languages
- English (primary)
- German
- Italian

### i18n Features
- **Translation System**: Django's built-in i18n framework
- **Locale-Aware Authentication**: I18nJWTAuth for language support
- **Translatable Models**: Multi-language content support
- **Translation Management**: Makefile commands for message extraction/compilation
- **Verification**: i18n-check ensures translations are up-to-date

**Note:** Internationalization is currently a work in progress.

---

## 📦 Deployment

### Self-Hosting
- **Docker Support**: Fully containerized application
- **docker-compose**: Production-ready configuration
- **Environment Configuration**: `.env` file-based settings
- **Database Migrations**: Automated via Django migrations
- **Static Files**: Configurable static file serving
- **Media Storage**: S3-compatible storage support

### Quick Start
```bash
# Clone repository
git clone https://github.com/letsrevel/revel-backend.git
cd revel-backend

# Download required geo data
# - IP2LOCATION-LITE-DB5.BIN → src/geo/data/
# - worldcities.csv → src/geo/data/

# Run automated setup
make setup

# Access API at http://localhost:8000
# Swagger docs at http://localhost:8000/api/docs
```

### Environment Requirements
- Python 3.13+
- PostgreSQL 15+ with PostGIS
- Redis 7+
- Docker & Docker Compose (recommended)
- MinIO or S3-compatible storage
- ClamAV (optional, for malware scanning)

---

## 🔧 Configuration

### Key Environment Variables
- `DEBUG`: Debug mode (default: True)
- `SECRET_KEY`: Django secret key
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `STRIPE_SECRET_KEY`: Stripe API key
- `EMAIL_BACKEND`: Email backend configuration
- `ENABLE_OBSERVABILITY`: Enable LGTM stack (default: True)
- `TRACING_SAMPLE_RATE`: OpenTelemetry sampling rate

### Observability Stack
- Grafana: http://localhost:3000 (admin/admin)
- Prometheus: http://localhost:9090
- Pyroscope: http://localhost:4040
- Loki: http://localhost:3100
- Tempo: http://localhost:3200
- Django Metrics: http://localhost:8000/metrics

---

## 🎯 Use Cases

### Community Organizations
- **LGBTQ+ Groups**: Safe, private event management with advanced screening
- **Sex-Positive Communities**: Privacy-focused platform without content restrictions
- **Social Clubs**: Membership tiers, recurring events, member-only access
- **Activist Organizations**: Secure coordination without data harvesting

### Event Types
- **Workshops & Classes**: Questionnaire-based admission, limited capacity
- **Social Gatherings**: Potluck coordination, dietary preference tracking
- **Recurring Meetups**: Event series with consistent settings
- **Conferences**: Multi-tier ticketing, resource distribution
- **Private Parties**: Invite-only access, guest lists
- **Fundraisers**: PWYC pricing, donation tracking

### Admin Features
- **Event Organizers**: Comprehensive admin panel for event management
- **Organization Owners**: Full organizational control and Stripe integration
- **Staff Members**: Granular permission delegation
- **Volunteer Coordinators**: Token-based volunteer recruitment

---

## 🚧 Known Limitations

### Beta Status
- Some features are marked as WIP (Work in Progress)
- Telegram integration is an early prototype
- Internationalization is incomplete
- Some edge cases may not be fully handled

### Not Yet Implemented
- Advanced analytics dashboard
- Email template customization
- Custom domains for organizations

---

## 🛣️ Roadmap

### Near-Term
- Complete i18n support for all features
- Enhanced Telegram bot integration
- Calendar feed generation
- Advanced reporting and analytics
- Email template editor
- User profile customization

### Long-Term
- Revamped frontend application
- Mobile apps (iOS/Android)
- Advanced questionnaire logic (conditional questions)

---

## 📄 License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgements

- **IP2Location**: IP geolocation database - https://lite.ip2location.com
- **SimpleMaps**: World Cities Database (CC BY 4.0) - https://simplemaps.com/data/world-cities
- **Django Community**: Excellent framework and ecosystem
- **Open Source Contributors**: Everyone who made this possible

---

## 🤝 Contributing

We welcome contributions! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) to learn how you can get involved:
- Report bugs via GitHub Issues
- Submit feature requests
- Contribute code via Pull Requests
- Improve documentation
- Add translations

---

## 📞 Support

- **Documentation**: See project README.md and docs/
- **Issues**: https://github.com/letsrevel/revel-backend/issues
- **Discussions**: GitHub Discussions

---

## 🔐 Security

For security concerns, please review our security policy or contact the maintainers directly. Do not publicly disclose security vulnerabilities.

---

## 📈 Pricing (Hosted Version)

When the hosted version launches:
- **Free Events**: No charge
- **Self-Managed Payments**: No charge
- **Paid Tickets via Revel**: 3% + €0.50 per ticket

**Current Status:** Self-hosting is completely free and open-source.

---

## 🎊 Thank You

Thank you for your interest in Revel! We're building something special for communities that value privacy, autonomy, and trust. Whether you're self-hosting or waiting for our hosted version, we're excited to have you as part of the community.

**Let's Revel! 🎉**


A few changes:

In the header: all in one **free**, open-source platform
In the flexible ticketing card, specify that organizers can use revel to manage and track offline payments. Stripe integration for card payments is optional. Find a concise phrasing.
In the Attendee screening card: Custom questionnaires with manual or automatic scoring; Optional AI-powered evauluation for free text responses
In the Potluck coordination: in the last point add: ", with privacy in mind".
In the Open source section, fix the link to just /letsrevel, to the org page instead of one of the four repos.
After additional features add a Free use and fair pricing section that explains Revel's pricing model.