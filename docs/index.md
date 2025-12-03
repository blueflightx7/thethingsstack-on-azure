# The Things Stack on Azure - Documentation Hub

> **Production-Ready LoRaWAN Network Server Deployment on Microsoft Azure**  
> Automated Infrastructure-as-Code with security hardening, monitoring, and operational best practices.

---

## 📚 Documentation Navigation

### 🎓 Learn
*Start here if you're new to The Things Stack on Azure*

- **[Getting Started Guide](learn/getting-started.md)** - Prerequisites, concepts, and first deployment
- **[Architecture Overview](learn/architecture-overview.md)** - High-level system design and components
- **[Deployment Modes Explained](learn/deployment-modes.md)** - VM vs AKS: Which one is right for you?
- **[Cost Planning](learn/cost-planning.md)** - Pricing breakdown and optimization strategies
- **[Security Overview](learn/security-overview.md)** - Built-in security features and compliance

### 🚀 Deploy
*Step-by-step deployment guides and configurations*

- **[Quick Start Deployment](deploy/quick-start.md)** - Get running in 10 minutes
- **[VM Deployment Guide](deploy/vm-deployment.md)** - Development/test environments
- **[AKS Deployment Guide](deploy/aks-deployment.md)** - Production Kubernetes deployments
- [**Deployment Orchestration**](deploy/orchestration.md) - How the `deploy.ps1` system works.
- [**IoT Hub & Data Intelligence**](deploy/integration-deployment.md) - Deploy the Azure data integration stack.
- [**Brownfield Guide**](deploy/brownfield-guide.md) - Deploying into existing Azure environments.
- **[DNS Configuration](deploy/dns-configuration.md)** - Custom domains, Azure DNS, and Let's Encrypt
- **[Parameter Reference](deploy/parameters.md)** - Complete deployment parameter documentation
- **[CI/CD Setup](deploy/cicd-setup.md)** - GitHub Actions and Azure DevOps pipelines

### ⚙️ Operate
*Day-2 operations, monitoring, and troubleshooting*

- **[Operations Guide](operate/operations-guide.md)** - Daily management tasks and procedures
- **[Monitoring & Alerts](operate/monitoring.md)** - Azure Monitor, Log Analytics, Application Insights
- **[Integration Operations](operate/integration-operations.md)** - Managing the IoT Hub integration.
- **[Fabric Connection](operate/fabric-connection-guide.md)** - Connecting Microsoft Fabric to TTS data.
- **[Troubleshooting Guide](operate/troubleshooting.md)** - Common issues and solutions
- **[Backup & Recovery](operate/backup-recovery.md)** - Data protection strategies
- **[Scaling Guide](operate/scaling.md)** - Vertical and horizontal scaling procedures
- **[Certificate Management](operate/certificates.md)** - Let's Encrypt renewal and custom certificates
- **[Upgrades & Maintenance](operate/upgrades.md)** - Updating TTS and infrastructure

### 📖 Reference
*Technical deep-dives and API documentation*

- **[Complete Architecture](reference/architecture.md)** - Detailed technical architecture (4,400+ lines)
- **[Integration Architecture](reference/integration-architecture.md)** - Architecture of the IoT Hub integration.
- **[Network Topology](reference/network-topology.md)** - VNet, subnets, NSG rules, and traffic flows
- **[Security Architecture](reference/security-architecture.md)** - Defense-in-depth security model
- **[Critical Fixes](reference/critical-fixes.md)** - 12 critical fixes that must be preserved
- **[Bicep Templates](reference/bicep-templates.md)** - Infrastructure-as-Code reference
- **[PowerShell Orchestration](reference/orchestration.md)** - Deployment script architecture
- **[API Reference](reference/api-reference.md)** - TTS API integration patterns

### 📜 History
*Project evolution and recovery documentation*

- **[Project History](history/project-history.md)** - Development timeline and milestones
- **[2024 Recovery](history/2024-recovery.md)** - Catastrophic recovery and 2,738+ lines rebuilt
- **[Deployment Fixes](history/deployment-fixes.md)** - Historical bug fixes and resolutions
- **[Security Evolution](history/security-evolution.md)** - Security feature development timeline
- **[Archive](archive/)** - Legacy documentation and deprecated guides

---

## 🗺️ Documentation Sitemap

```
┌─────────────────────────────────────────────────────────────────────┐
│                    The Things Stack on Azure                        │
│                      Documentation Hub                              │
└─────────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
   ┌─────────┐              ┌─────────┐              ┌─────────┐
   │  LEARN  │              │  DEPLOY │              │ OPERATE │
   └─────────┘              └─────────┘              └─────────┘
        │                         │                         │
   Getting Started          Quick Start              Operations Guide
   Architecture            VM Deployment            Monitoring
   Deployment Modes        AKS Deployment           Troubleshooting
   Cost Planning          Brownfield               Backup/Recovery
   Security               DNS Config               Scaling
        │                         │                         │
        └─────────────────────────┼─────────────────────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                ▼                                   ▼
          ┌──────────┐                        ┌─────────┐
          │ REFERENCE│                        │ HISTORY │
          └──────────┘                        └─────────┘
                │                                   │
        Architecture Deep-dive              Project Timeline
        Network Topology                    2024 Recovery
        Security Architecture               Deployment Fixes
        Critical Fixes                      Security Evolution
        Bicep/PowerShell Docs              Archive
```

---

## 🎯 Quick Reference by Role

### 👨‍💻 **Developers / New Users**
1. Start → [Getting Started Guide](learn/getting-started.md)
2. Choose → [Deployment Modes](learn/deployment-modes.md)
3. Deploy → [Quick Start](deploy/quick-start.md)

### 🏗️ **Infrastructure Engineers**
1. Review → [Architecture Overview](learn/architecture-overview.md)
2. Plan → [Deployment Parameters](deploy/parameters.md)
3. Deploy → [VM Guide](deploy/vm-deployment.md) or [AKS Guide](deploy/aks-deployment.md)
4. Secure → [Security Architecture](reference/security-architecture.md)

### 🔧 **Operations Teams**
1. Monitor → [Monitoring & Alerts](operate/monitoring.md)
2. Troubleshoot → [Troubleshooting Guide](operate/troubleshooting.md)
3. Maintain → [Operations Guide](operate/operations-guide.md)
4. Scale → [Scaling Guide](operate/scaling.md)

### 🔒 **Security Engineers**
1. Understand → [Security Overview](learn/security-overview.md)
2. Review → [Security Architecture](reference/security-architecture.md)
3. Harden → [Security Hardening Guide](reference/security-hardening.md)

### 📊 **Project Managers / Architects**
1. Overview → [Architecture Overview](learn/architecture-overview.md)
2. Cost → [Cost Planning](learn/cost-planning.md)
3. Roadmap → [Future Enhancements](reference/architecture.md#12-future-enhancements)

---

## 🔍 Finding What You Need

### By Task

| I want to... | Go to... |
|-------------|----------|
| Deploy for the first time | [Quick Start](deploy/quick-start.md) |
| Deploy into existing VNet | [Brownfield Guide](deploy/brownfield-guide.md) |
| Understand the architecture | [Architecture Overview](learn/architecture-overview.md) |
| Fix deployment errors | [Troubleshooting](operate/troubleshooting.md) |
| Set up monitoring | [Monitoring Guide](operate/monitoring.md) |
| Configure custom domain | [DNS Configuration](deploy/dns-configuration.md) |
| Scale my deployment | [Scaling Guide](operate/scaling.md) |
| Understand costs | [Cost Planning](learn/cost-planning.md) |
| Review security features | [Security Overview](learn/security-overview.md) |
| Modify Bicep templates | [Critical Fixes](reference/critical-fixes.md) + [Bicep Reference](reference/bicep-templates.md) |

### By Deployment Mode

| Mode | Description | Documentation |
|------|-------------|---------------|
| **Quick** | Single-command VM deployment for dev/test | [Quick Start](deploy/quick-start.md) |
| **VM** | Advanced VM deployment with custom parameters | [VM Deployment Guide](deploy/vm-deployment.md) |
| **AKS** | Production Kubernetes deployment | [AKS Deployment Guide](deploy/aks-deployment.md) |
| **Brownfield** | Deploy into existing infrastructure | [Brownfield Guide](deploy/brownfield-guide.md) |
| **Monitoring** | Add monitoring to existing deployment | [Monitoring Guide](operate/monitoring.md) |

---

## 📝 Documentation Standards

All documentation follows these standards:

- ✅ **Front-matter metadata** - Title, status, owner, last updated
- ✅ **Consistent formatting** - Headings, code blocks, tables, admonitions
- ✅ **Cross-references** - Links to related documentation
- ✅ **Version tracking** - Change history and update dates
- ✅ **Diagrams** - Architecture and flow diagrams where applicable
- ✅ **Examples** - Working code samples and command snippets

---

## 🆘 Need Help?

- **Quick Questions**: Check [Troubleshooting Guide](operate/troubleshooting.md)
- **Architecture Questions**: See [Architecture Overview](learn/architecture-overview.md)
- **Deployment Issues**: Review [Critical Fixes](reference/critical-fixes.md)
- **Operations Help**: Consult [Operations Guide](operate/operations-guide.md)
- **GitHub Issues**: [Report a bug or request feature](https://github.com/blueflightx7/thethingsstack-on-azure/issues)

---

## 📊 Documentation Statistics

- **Total Docs**: 30+ markdown files
- **Total Content**: 15,000+ lines
- **Diagrams**: 20+ architecture and flow diagrams
- **Code Samples**: 500+ working examples
- **Last Major Update**: November 2025

---

## 🔄 Recent Updates

| Date | Update | Section |
|------|--------|---------|
| 2025-11-21 | Documentation reorganization and beautification | All |
| 2025-10-11 | Added brownfield DNS configuration guide | Deploy |
| 2025-10-10 | Completed monitoring add-on feature | Operate |
| 2025-10-05 | Added 12 critical fixes documentation | Reference |
| 2025-09-15 | Catastrophic recovery completed | History |

---

**Made with ❤️ for the LoRaWAN Community**

[Back to Repository](../README.md) | [View on GitHub](https://github.com/blueflightx7/thethingsstack-on-azure)
