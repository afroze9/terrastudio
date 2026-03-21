# Resource Audit & Evaluation Criteria

Checklist for evaluating whether a TerraStudio plugin resource provides maximum Terraform HCL coverage for the corresponding `azurerm_*` (or `aws_*`) resource.

---

## 1. Schema Completeness

### 1.1 Property Coverage

| # | Criterion | Weight | How to Check |
|---|-----------|--------|-------------|
| 1.1.1 | **All required Terraform arguments** are represented as properties with `required: true` | Critical | Compare schema `properties[]` against Terraform docs "Required" section |
| 1.1.2 | **Common optional arguments** are represented as properties | High | Check Terraform docs "Optional" section — include arguments used in >30% of real-world configs |
| 1.1.3 | **Advanced optional arguments** are represented (at minimum in a collapsed group) | Medium | Arguments for enterprise/production scenarios (networking, identity, monitoring, encryption) |
| 1.1.4 | **Nested blocks** are modeled using `type: 'object'` with `nestedSchema` or `type: 'array'` with `itemSchema` | High | Compare Terraform nested blocks against schema nested types |
| 1.1.5 | **Conditional properties** use `visibleWhen` to hide irrelevant fields | Medium | E.g., auto-scaling min/max only visible when auto-scaling is enabled |
| 1.1.6 | **No hardcoded defaults that override Terraform defaults** unless intentional | Medium | Check `defaultValue` — should match or omit (let Terraform decide) |

### 1.2 Property Type Accuracy

| # | Criterion | Weight | How to Check |
|---|-----------|--------|-------------|
| 1.2.1 | String arguments → `type: 'string'` | Critical | |
| 1.2.2 | Enum arguments → `type: 'select'` with all valid `options` from Terraform docs | Critical | Missing options = users can't set valid values |
| 1.2.3 | Boolean arguments → `type: 'boolean'` | Critical | |
| 1.2.4 | Number arguments → `type: 'number'` with `min`/`max` validation | High | |
| 1.2.5 | CIDR arguments → `type: 'cidr'` | High | |
| 1.2.6 | List arguments → `type: 'array'` with correct `itemSchema` | High | |
| 1.2.7 | Map arguments → `type: 'key-value-map'` or `type: 'tags'` | High | |
| 1.2.8 | Multi-select arguments → `type: 'multiselect'` with all valid options | High | |
| 1.2.9 | Cross-resource references → `type: 'reference'` with correct `referenceTargetTypes` | High | |
| 1.2.10 | Sensitive arguments → `sensitive: true` flag set | Medium | Passwords, keys, connection strings |

### 1.3 Validation Rules

| # | Criterion | Weight | How to Check |
|---|-----------|--------|-------------|
| 1.3.1 | **Name constraints** match Azure/Terraform limits (minLength, maxLength, pattern) | High | Check Azure resource naming rules |
| 1.3.2 | **Numeric ranges** match Terraform validation (min, max) | High | E.g., priority 100-4096 for NSG rules |
| 1.3.3 | **Pattern validation** matches Terraform accepted formats | Medium | Regex patterns for specialized inputs |
| 1.3.4 | **Required fields** are correctly marked | Critical | `required: true` matches Terraform "Required" designation |
| 1.3.5 | **Naming constraints** are set when resource has special rules | Medium | `namingConstraints: { lowercase, noHyphens, maxLength }` for storage accounts, etc. |

---

## 2. HCL Generator Completeness

### 2.1 Argument Emission

| # | Criterion | Weight | How to Check |
|---|-----------|--------|-------------|
| 2.1.1 | **Every schema property** has corresponding HCL emission in the generator | Critical | Walk each `properties[]` entry — is it emitted in `generate()`? |
| 2.1.2 | **`context.getPropertyExpression()`** is used for all scalar properties (not manual string formatting) | Critical | Enables variable mode toggle for every property |
| 2.1.3 | **Resource Group reference** uses `context.getResourceGroupExpression()` | High | Not hardcoded |
| 2.1.4 | **Location reference** uses `context.getLocationExpression()` | High | Not hardcoded |
| 2.1.5 | **Cross-resource references** use `resource.references[key]` + `context.getAttributeReference()` | High | Not hardcoded IDs |
| 2.1.6 | **Optional properties** are conditionally emitted (skip if empty/default, unless in variable mode) | High | Check `resource.variableOverrides?.[key] === 'variable'` for empty-but-variable-mode fields |
| 2.1.7 | **Nested blocks** are correctly formatted as HCL sub-blocks | High | `site_config { ... }`, `identity { ... }`, etc. |
| 2.1.8 | **Array properties** emit correct HCL list syntax | High | `["item1", "item2"]` or repeated blocks |
| 2.1.9 | **Boolean properties** emit unquoted `true`/`false` | Medium | Not `"true"` strings |
| 2.1.10 | **Tags block** is emitted when `supportsTags: true` | Medium | Usually `tags = local.common_tags` |

### 2.2 Auxiliary Resources

| # | Criterion | Weight | How to Check |
|---|-----------|--------|-------------|
| 2.2.1 | **Association resources** are generated when the Azure resource requires them | Critical | E.g., `azurerm_subnet_network_security_group_association` for NSG→Subnet |
| 2.2.2 | **Data sources** are generated when needed | High | E.g., `data.azurerm_client_config` for Key Vault tenant_id |
| 2.2.3 | **Role assignments** are generated for RBAC-based resources | Medium | `azurerm_role_assignment` for managed identity scenarios |
| 2.2.4 | **Auxiliary resources** have correct `dependsOn` | High | Must depend on the parent resource |

### 2.3 Terraform Type Resolution

| # | Criterion | Weight | How to Check |
|---|-----------|--------|-------------|
| 2.3.1 | **OS-variant resources** implement `resolveTerraformType()` | Critical | E.g., `azurerm_linux_web_app` vs `azurerm_windows_web_app` |
| 2.3.2 | **`terraformType`** matches exact Terraform provider resource name | Critical | Typos = broken generation |
| 2.3.3 | **Block type** is correct (`'resource'`, `'data'`, `'locals'`, etc.) | Critical | |

---

## 3. Handle & Connection Coverage

### 3.1 Handle Definitions

| # | Criterion | Weight | How to Check |
|---|-----------|--------|-------------|
| 3.1.1 | Every **association relationship** the resource participates in has a handle | High | Check Terraform docs for `_id` suffix arguments that reference other resources |
| 3.1.2 | Handle `type` is correct (`'source'` for provider, `'target'` for consumer) | Critical | Source emits the reference, target receives it |
| 3.1.3 | Handle `position` is semantically consistent (left/right for peers, top/bottom for hierarchy) | Low | UX consistency |
| 3.1.4 | `maxConnections` is set when the relationship is 1:1 | Medium | E.g., a VM can only be in one availability set |
| 3.1.5 | `acceptsTypes` is set on source handles to restrict valid targets | Medium | Prevents invalid connections |
| 3.1.6 | `acceptsOutputs: true` is set on data-sink handles | Medium | Only for handles that accept arbitrary output data (e.g., Key Vault secret-in) |
| 3.1.7 | **Private endpoint handle** (`pep-target`) is present if the resource supports Private Endpoints | Medium | Most PaaS resources support this |

### 3.2 Connection Rules

| # | Criterion | Weight | How to Check |
|---|-----------|--------|-------------|
| 3.2.1 | Every handle pair has a corresponding `ConnectionRule` in the plugin's rules | Critical | Handles without rules = unconnectable |
| 3.2.2 | `createsReference` is set with correct `side` and `propertyKey` | Critical | Must match the HCL generator's expected `resource.references[key]` |
| 3.2.3 | Cross-plugin connections are registered in the consuming plugin | High | E.g., Subnet→AKS rule lives in compute plugin |
| 3.2.4 | `label` provides a clear description of the relationship | Low | UX clarity |
| 3.2.5 | `outputBinding` is set for data-flow edges | Medium | When the edge generates intermediate Terraform resources |

### 3.3 Binding Generators

| # | Criterion | Weight | How to Check |
|---|-----------|--------|-------------|
| 3.3.1 | Resources with `acceptsOutputs` handles have matching `BindingHclGenerator` | Critical | Otherwise outputs connect but generate no HCL |
| 3.3.2 | `sourceType` is `undefined` for wildcard bindings, specific for targeted bindings | High | |
| 3.3.3 | Binding generator produces correct intermediate Terraform resource | Critical | E.g., `azurerm_key_vault_secret` for KV secret binding |

---

## 4. Containment Model

| # | Criterion | Weight | How to Check |
|---|-----------|--------|-------------|
| 4.1 | **`isContainer: true`** is set for resources that logically contain others | Critical | Resource Groups, VNets, Subnets |
| 4.2 | **`canBeChildOf`** lists all valid parent container types | Critical | E.g., Subnet can be child of VNet |
| 4.3 | **`parentReference`** is set with correct `propertyKey` when placement implies a Terraform reference | Critical | E.g., Subnet inside VNet → `virtual_network_name` |
| 4.4 | **`visualContainment: true`** is set for visual-only placement (no Terraform reference) | Medium | PaaS resources inside Subnets for diagram clarity |
| 4.5 | **`containerStyle`** is defined with appropriate visual styling | Low | Border color, style, background |
| 4.6 | **`minSize`** is set for containers to prevent tiny containers | Low | |
| 4.7 | **`requiresResourceGroup: true`** is set for all Azure resources that need a Resource Group | Critical | Almost all Azure resources |

---

## 5. Output Definitions

| # | Criterion | Weight | How to Check |
|---|-----------|--------|-------------|
| 5.1 | **Resource ID** is always available as an output (`key: 'id'`) | High | Almost every Terraform resource exports `id` |
| 5.2 | **Connection strings** and **access keys** are exposed with `sensitive: true` | High | Storage accounts, databases, Key Vaults |
| 5.3 | **Hostnames/endpoints** are exposed for web-facing resources | High | App Services, API Management, AKS |
| 5.4 | **Principal/identity IDs** are exposed for identity-bearing resources | Medium | AKS kubelet identity, managed identities |
| 5.5 | **`terraformAttribute`** matches the exact Terraform attribute name | Critical | Typo = broken reference |
| 5.6 | Outputs that are commonly used in downstream resources are included | High | Check Terraform docs "Attributes Reference" section |

---

## 6. Metadata & UX

### 6.1 Resource Metadata

| # | Criterion | Weight | How to Check |
|---|-----------|--------|-------------|
| 6.1.1 | **`displayName`** is clear and matches Azure portal naming | Low | |
| 6.1.2 | **`description`** explains what the resource is | Low | |
| 6.1.3 | **`category`** matches the plugin's palette categories | Medium | Must exist in `paletteCategories` |
| 6.1.4 | **`cafAbbreviation`** follows Azure CAF naming conventions | Medium | E.g., `vm`, `asp`, `st`, `kv` |
| 6.1.5 | **`hideFromPalette`** is set only for internal/helper resources | Low | |

### 6.2 Icon

| # | Criterion | Weight | How to Check |
|---|-----------|--------|-------------|
| 6.2.1 | Icon uses official Azure/AWS SVG from `temp/` directory when available | Low | |
| 6.2.2 | SVG IDs are shortened to avoid DOM conflicts | Low | No UUID-style IDs |
| 6.2.3 | Icon renders at 18x18 without distortion | Low | |

### 6.3 Property UX

| # | Criterion | Weight | How to Check |
|---|-----------|--------|-------------|
| 6.3.1 | Properties are organized into logical `group` sections | Medium | "General", "Networking", "Security", etc. |
| 6.3.2 | Properties have meaningful `order` within groups | Low | Most important first |
| 6.3.3 | Properties have `placeholder` text where helpful | Low | |
| 6.3.4 | `description` is set for non-obvious properties | Low | |

### 6.4 Cost Estimation

| # | Criterion | Weight | How to Check |
|---|-----------|--------|-------------|
| 6.4.1 | **`costEstimation`** is set with correct `serviceName` | Medium | Azure Retail Prices API service name |
| 6.4.2 | **`skuProperty`** points to the correct property key | Medium | |
| 6.4.3 | **`staticMonthlyCost: 0`** is set for free resources (RG, VNet, NSG) | Low | |
| 6.4.4 | **`usageInputs`** are defined for usage-based pricing | Low | Storage GB, operations/month, etc. |

---

## 7. Variable Mode Support

| # | Criterion | Weight | How to Check |
|---|-----------|--------|-------------|
| 7.1 | **All properties** support variable toggle (handled automatically by `getPropertyExpression`) | Critical | Generator must use `context.getPropertyExpression()` — not manual formatting |
| 7.2 | **Variable names** are descriptive (custom `variableName` option when auto-generated name is unclear) | Low | |
| 7.3 | **Variable types** are correct (`variableType` option: `'string'`, `'number'`, `'list(string)'`, `'bool'`) | High | Must match Terraform variable type |
| 7.4 | **Sensitive properties** pass `sensitive: true` to `getPropertyExpression` options | High | Passwords, keys, connection strings |
| 7.5 | **Empty-but-variable-mode** properties still emit (check `variableOverrides?.[key] === 'variable'`) | High | User intends to supply value at runtime |

---

## 8. Private Endpoint Support

| # | Criterion | Weight | How to Check |
|---|-----------|--------|-------------|
| 8.1 | **`privateEndpointConfig`** is set for PaaS resources that support Private Endpoints | Medium | Storage, Key Vault, SQL, App Service, etc. |
| 8.2 | **`subresources`** lists all valid Private Link subresource names | Medium | Check Azure docs for `group_id` values |
| 8.3 | **`defaultSubresource`** is set to the most common one | Low | |
| 8.4 | **`pep-target`** handle exists on the resource | Medium | Required for PE connections |

---

## 9. Naming Convention Support

| # | Criterion | Weight | How to Check |
|---|-----------|--------|-------------|
| 9.1 | **`cafAbbreviation`** is set per Azure CAF guidelines | Medium | `rg`, `vnet`, `snet`, `vm`, `kv`, `st`, etc. |
| 9.2 | **`namingConstraints`** are set when resource has special naming rules | Medium | Storage accounts: `{ lowercase: true, noHyphens: true, maxLength: 24 }` |
| 9.3 | **Container resources** that contribute tokens have `namingTokenSources` | Low | Resource Groups contributing `env` and `region` tokens |

---

## Scoring Guide

For each resource, score against the criteria above:

| Rating | Coverage | Description |
|--------|----------|-------------|
| **A (90-100%)** | Production-ready | All critical + high items pass. Most medium items pass. Covers the Terraform resource's common use cases comprehensively. |
| **B (70-89%)** | Good coverage | All critical items pass. Most high items pass. Handles standard deployments but may miss enterprise/advanced scenarios. |
| **C (50-69%)** | Basic coverage | Critical items pass. Several high items missing. Works for simple deployments. |
| **D (30-49%)** | Minimal | Some critical items missing. Only covers the most basic configuration. |
| **F (<30%)** | Incomplete | Missing critical items. Resource will produce broken or unusable Terraform. |

### Priority Order for Remediation

1. **Critical items** — Fix immediately. These cause broken HCL or missing functionality.
2. **High items** — Fix next. These limit real-world usability.
3. **Medium items** — Fix when time allows. These improve quality and UX.
4. **Low items** — Nice to have. Polish and consistency.

---

## Audit Procedure

1. **Pick a resource** to audit
2. **Open the Terraform provider docs** for that resource (e.g., `registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/...`)
3. **Walk through each section** of this checklist, comparing the schema/generator against the Terraform docs
4. **Record findings** in a table: criterion number, pass/fail, notes
5. **Calculate score** by weight category
6. **Prioritize fixes** by weight (Critical → High → Medium → Low)

---

## Quick Reference: Common Terraform Features to Check

For any Azure resource, verify coverage of these common Terraform argument patterns:

```
Required Arguments:
  ├── name
  ├── resource_group_name  (via requiresResourceGroup + context)
  ├── location             (via context.getLocationExpression)
  └── [resource-specific required args]

Common Optional Arguments:
  ├── tags                 (via supportsTags)
  ├── identity { type, identity_ids }
  ├── network_rules / network_acls
  ├── encryption settings
  ├── monitoring / diagnostic settings
  └── sku / tier / capacity

Cross-Resource References:
  ├── *_id arguments       (handles + connection rules)
  ├── subnet_id            (networking integration)
  ├── key_vault_id         (encryption/secrets)
  └── log_analytics_workspace_id (monitoring)

Computed Attributes (outputs):
  ├── id                   (always)
  ├── *_endpoint           (PaaS resources)
  ├── *_connection_string  (data resources)
  ├── *_access_key         (storage/cache)
  ├── principal_id         (identity-bearing)
  └── fqdn / hostname      (web-facing)
```
