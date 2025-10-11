# Changelog

All notable changes to this TTS deployment project are documented in this file.

## [1.5.0] - 2025-10-11 - CURRENT VERSION

### Added - Fix #11: Container Readiness Wait
- Added comprehensive container readiness checks before admin user creation
- Initial 30-second wait after container start
- Readiness test loop (10 attempts × 10 seconds) using `is-db --help`
- Admin user creation retry with proper delays (5 attempts × 10 seconds)
- Total maximum initialization time: ~3 minutes
- **Impact**: Admin user now created reliably during automated deployment

### Fixed
- Admin user creation now succeeds during cloud-init (not just manual creation)
- Eliminated "password did not match" errors
- Deployment fully automated - no manual post-deployment steps required

## [1.4.0] - 2025-10-10

### Fixed - Fix #10 Corrected: Password Confirmation
- Changed from `echo -e '{9}\n{9}'` to `printf '%s\n%s\n' '{9}' '{9}'`
- Fixed shell escape sequence interpretation issue
- Password confirmation now works in Bicep format strings

### Known Issues (Resolved in 1.5.0)
- Admin user creation still failed during deployment
- Worked when manually executed after deployment

## [1.3.0] - 2025-10-10

### Added - Fix #10 (Initial Attempt - FAILED)
- Attempted to fix password confirmation with `echo -e '{9}\n{9}'`
- Did not work due to single-quote escape issue

### Known Issues (Fixed in 1.4.0)
- Single quotes prevented `\n` interpretation
- "password did not match" errors persisted

## [1.2.0] - 2025-10-09

### Added - Fixes #6-9
- **Fix #6**: Database config path - Always use `/config/tts.yml`
- **Fix #7**: Console API base URLs - Correct domain references
- **Fix #8**: OAuth single redirect URI - Proper OAuth flow
- **Fix #9**: Retry logic for timing issues - Robust initialization

### Improved
- More reliable database initialization
- Better error handling with retries
- Proper OAuth client creation

## [1.1.0] - 2025-10-08

### Added - Fixes #1-5
- **Fix #1**: PostgreSQL password validation - Alphanumeric only
- **Fix #2**: Database username synchronization - Consistent everywhere
- **Fix #3**: Cookie block key length - Exactly 64 characters
- **Fix #4**: PostgreSQL server state check - Wait for readiness
- **Fix #5**: Admin email validation - Proper format enforcement

### Improved
- Database connection reliability
- TTS startup stability
- Configuration consistency

## [1.0.0] - 2025-10-07

### Initial Release
- Basic TTS deployment on Azure
- Docker-based deployment
- PostgreSQL Flexible Server
- Manual post-deployment steps required
- SSL certificate generation
- Basic networking and security

### Known Issues (Fixed in subsequent versions)
- Required manual admin user creation
- Required manual OAuth client creation
- Database connection issues
- Timing-related failures
- Configuration inconsistencies

---

## Migration Guide

### From 1.0.0 to 1.5.0

If you have deployments from version 1.0.0:

1. **No migration needed** - Just redeploy with new template
2. **Manual cleanups** will be automated in new deployments
3. **Existing deployments** can continue to run but won't have auto-fixes

### What Changed

**Removed Manual Steps:**
- ❌ No longer need to SSH and create admin user manually
- ❌ No longer need to create OAuth client manually
- ❌ No longer need to restart containers manually

**New Automated Steps:**
- ✅ Admin user created automatically during deployment
- ✅ OAuth client created automatically during deployment
- ✅ All initialization retried automatically on failure
- ✅ Container readiness verified before proceeding

## Future Roadmap

### Planned Features
- [ ] Azure Container Instances deployment option
- [ ] Azure Kubernetes Service (AKS) deployment
- [ ] Let's Encrypt certificate automation
- [ ] Custom domain with Azure DNS
- [ ] Multi-region deployment
- [ ] Automated backup configuration
- [ ] Prometheus metrics export
- [ ] Grafana dashboard templates

### Under Consideration
- [ ] Azure Application Gateway integration
- [ ] Azure Front Door CDN
- [ ] Azure Firewall integration
- [ ] Private Link for all services
- [ ] Azure Monitor alerting
- [ ] Cost optimization recommendations

## Version Support

| Version | Status | Support End Date |
|---------|--------|------------------|
| 1.5.0 | Current | - |
| 1.4.0 | Superseded | 2025-10-11 |
| 1.3.0 | Superseded | 2025-10-10 |
| 1.2.0 | Deprecated | 2025-10-09 |
| 1.1.0 | Deprecated | 2025-10-08 |
| 1.0.0 | Deprecated | 2025-10-07 |

## Breaking Changes

### 1.5.0
- None (fully backward compatible)

### 1.4.0
- None (fully backward compatible)

### 1.3.0
- None (fully backward compatible)

### 1.2.0
- Changed OAuth client creation to use single redirect URI
- May affect existing OAuth configurations

### 1.1.0
- Changed database password generation (alphanumeric only)
- May require redeployment if using special characters

### 1.0.0
- Initial release

## Upgrade Instructions

### To Upgrade to Latest Version

1. **Backup existing data** (if applicable):
   ```bash
   ssh ttsadmin@<vm-ip>
   sudo docker exec lorawan-stack_stack_1 pg_dump -U ttsadmin ttn_lorawan > backup.sql
   ```

2. **Deploy new version**:
   ```powershell
   .\deploy-simple.ps1 -AdminEmail "your-email@example.com"
   ```

3. **Restore data** (if needed):
   ```bash
   cat backup.sql | sudo docker exec -i lorawan-stack_stack_1 psql -U ttsadmin ttn_lorawan
   ```

## Bug Fixes by Version

### 1.5.0
- Fixed: Admin user not created during deployment
- Fixed: Container readiness not properly checked
- Fixed: Timing issues in cloud-init

### 1.4.0
- Fixed: Password confirmation escape sequence issue
- Fixed: printf vs echo behavior in cloud-init

### 1.3.0
- Attempted fix for password confirmation (unsuccessful)

### 1.2.0
- Fixed: OAuth redirect URI mismatch
- Fixed: Console API URLs incorrect
- Fixed: Database config path wrong
- Fixed: Timing issues in initialization

### 1.1.0
- Fixed: PostgreSQL password rejection
- Fixed: Database username inconsistency
- Fixed: Cookie key length validation
- Fixed: PostgreSQL not ready before connection
- Fixed: Invalid email format allowed

### 1.0.0
- Initial bugs documented in FIXES.md

## Contributors

This project incorporates fixes and improvements discovered through:
- Deployment testing and validation
- User feedback
- Azure best practices
- The Things Stack community input

## License

See LICENSE file for details.
