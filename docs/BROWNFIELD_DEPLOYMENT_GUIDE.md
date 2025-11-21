# Brownfield Deployment Guide

## Overview

This guide explains how to deploy The Things Stack to an **existing VNet** (brownfield environment) with proper handling of resource locks, subnet delegation, and cross-resource-group references.

## Prerequisites

### Required Information

When deploying to an existing VNet, you need:

1. **VNet Name**: The name of your existing Virtual Network
2. **VNet Resource Group**: The resource group containing the VNet (can be different from deployment RG)
3. **VM Subnet Name**: The subnet where the VM will be deployed
4. **Database Subnet Name**: A subnet with PostgreSQL delegation for the database

### Network Requirements

#### VNet Location Matching
- The deployment **MUST** be in the **same Azure region** as your VNet
- The script automatically detects the VNet location and adjusts deployment region

#### Subnet Requirements

**VM Subnet:**
- Must have available IP addresses (at least 1)
- Should NOT have subnet delegation
- Can share the same VNet with database subnet

**Database Subnet:**
- **MUST** be delegated to `Microsoft.DBforPostgreSQL/flexibleServers`
- Must have at least 11 available IP addresses (minimum /28 CIDR)
- **CANNOT** share the same subnet as VM or other resources
- Per Azure requirement: "only PostgreSQL Flexible Server instances can use delegated subnet"

## Common Issues & Solutions

### Issue 1: Resource Lock on VNet

**Error Message:**
```
Operation on resource [...] is blocking by customer lock
Lock Name: VNET-LOCK-SFI
Lock Level: CanNotDelete
```

**Cause**: VNet has a resource lock that prevents modifications (including subnet delegation)

**Solution Options (script will prompt):**

**Option 1: Temporary Lock Removal (Recommended)**
```powershell
# Script automatically:
# 1. Removes lock(s)
# 2. Adds PostgreSQL delegation
# 3. Re-applies lock(s)
```

**Option 2: Manual Delegation**
```powershell
# You must run BEFORE deployment:
Remove-AzResourceLock -LockId <lock-id> -Force

$vnet = Get-AzVirtualNetwork -Name 'your-vnet' -ResourceGroupName 'vnet-rg'
$subnet = Get-AzVirtualNetworkSubnetConfig -VirtualNetwork $vnet -Name 'db-subnet'
$subnet.Delegations.Add((New-Object Microsoft.Azure.Commands.Network.Models.PSDelegation -Property @{
    Name = 'PostgreSQLFlexibleServer'
    ServiceName = 'Microsoft.DBforPostgreSQL/flexibleServers'
}))
Set-AzVirtualNetwork -VirtualNetwork $vnet

New-AzResourceLock -LockName 'VNET-LOCK-SFI' -LockLevel CanNotDelete `
    -ResourceGroupName 'vnet-rg' -ResourceName 'your-vnet' `
    -ResourceType 'Microsoft.Network/virtualNetworks'
```

**Option 3: Public Database Access**
- Disables private VNet integration
- Database uses public endpoint with firewall rules
- Not recommended for production

### Issue 2: VNet Location Mismatch

**Error Message:**
```
The virtual network [...] coming from a different location eastus is currently not supported, expected location centralus
```

**Cause**: Deployment region doesn't match VNet region

**Solution**: The script automatically detects VNet location and uses it for deployment (fixed in latest version)

### Issue 3: Cross-Resource-Group Subnet Not Found

**Error Message:**
```
Resource /subscriptions/.../Microsoft.Network/virtualNetworks/vnet/subnets/subnet referenced by resource [...] was not found
```

**Cause**: Missing subscription ID in cross-RG resourceId() calls

**Solution**: Fixed in Bicep template (all cross-RG references now include subscription ID)

## Deployment Workflow

### Step-by-Step Process

1. **Run Deployment Script**
   ```powershell
   .\deploy.ps1 -Mode quick
   ```

2. **Select Existing VNet**
   - Choose "Search all VNets across subscription" to find cross-RG VNets
   - Script detects VNet location automatically

3. **Select VM Subnet**
   - Pick the subnet for VM deployment
   - Script validates no conflicting delegations

4. **Select/Configure Database Subnet**
   - **If delegated subnet exists**: Auto-selected
   - **If NO delegated subnet**: Script offers to delegate an existing subnet
   - **If resource lock detected**: Choose lock removal option

5. **Deployment Proceeds**
   - Infrastructure deployed to same region as VNet
   - VM uses selected VM subnet
   - PostgreSQL uses delegated database subnet
   - Private DNS zone links to existing VNet

### Network Architecture

```
Existing VNet (e.g., 10.0.0.0/16)
├── VM Subnet (e.g., 10.0.0.0/24)
│   └── TTS VM
├── Database Subnet (e.g., 10.0.1.0/24) [DELEGATED]
│   └── PostgreSQL Flexible Server
└── Private DNS Zone Link
    └── privatelink.postgres.database.azure.com
```

## Best Practices

### Planning Your Network

1. **Subnet Sizing**:
   - VM Subnet: /24 (256 IPs) recommended for scalability
   - Database Subnet: /28 (16 IPs) minimum, /26 (64 IPs) recommended for HA

2. **Subnet Naming**:
   - Use descriptive names (e.g., `tts-vm-subnet`, `tts-db-subnet`)
   - Avoid generic names like `default` or `subnet1`

3. **Resource Organization**:
   - VNet in dedicated "networking" resource group
   - TTS resources in separate resource group
   - Enables better RBAC and cost tracking

### Security Considerations

1. **Network Security Groups**:
   - VM Subnet: Allow SSH (restricted IP), HTTP/HTTPS, LoRaWAN UDP 1700
   - Database Subnet: Allow PostgreSQL 5432 only from VM subnet

2. **Private Database Access**:
   - Always use private access in production
   - Public access only for dev/test

3. **Resource Locks**:
   - Keep locks enabled for production VNets
   - Use script's automatic lock removal/re-application

## Troubleshooting

### Check Subnet Delegation

```powershell
$vnet = Get-AzVirtualNetwork -Name 'your-vnet' -ResourceGroupName 'vnet-rg'
$vnet.Subnets | ForEach-Object {
    Write-Host "Subnet: $($_.Name)"
    Write-Host "  Delegation: $($_.Delegations[0].ServiceName)"
}
```

### Check Resource Locks

```powershell
Get-AzResourceLock -ResourceGroupName 'vnet-rg' -ResourceName 'your-vnet' `
    -ResourceType 'Microsoft.Network/virtualNetworks'
```

### Verify VNet Region

```powershell
$vnet = Get-AzVirtualNetwork -Name 'your-vnet' -ResourceGroupName 'vnet-rg'
Write-Host "VNet Location: $($vnet.Location)"
```

## Reference Documentation

- [Azure PostgreSQL VNet Integration](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-networking-private)
- [Subnet Delegation Overview](https://learn.microsoft.com/en-us/azure/virtual-network/subnet-delegation-overview)
- [Azure Resource Locks](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/lock-resources)

## Support

For issues not covered in this guide:
1. Check deployment logs in Azure Portal
2. Review `DEPLOYMENT_FIXES_SUMMARY.md` for known issues
3. Open GitHub issue with deployment error details
