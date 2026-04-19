import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com';
const AZDO_ISSUER = 'https://vstoken.dev.azure.com';
const K8S_ISSUER = 'https://kubernetes.default.svc';
const DEFAULT_AUDIENCE = 'api://AzureADTokenExchange';

function resolvePreset(props: Record<string, unknown>): { issuer: string; subject: string } | null {
  const preset = (props['preset'] as string) ?? 'custom';
  const org = (props['github_org'] as string) ?? '';
  const repo = (props['github_repo'] as string) ?? '';
  const ref = (props['github_ref'] as string) ?? 'main';
  const env = (props['github_environment'] as string) ?? '';

  switch (preset) {
    case 'github_branch':
      return { issuer: GITHUB_ISSUER, subject: `repo:${org}/${repo}:ref:refs/heads/${ref}` };
    case 'github_tag':
      return { issuer: GITHUB_ISSUER, subject: `repo:${org}/${repo}:ref:refs/tags/${ref}` };
    case 'github_pr':
      return { issuer: GITHUB_ISSUER, subject: `repo:${org}/${repo}:pull_request` };
    case 'github_env':
      return { issuer: GITHUB_ISSUER, subject: `repo:${org}/${repo}:environment:${env}` };
    case 'azdo':
      return { issuer: AZDO_ISSUER, subject: 'sc://<org>/<project>/<service-connection>' };
    case 'k8s':
      return { issuer: K8S_ISSUER, subject: 'system:serviceaccount:<namespace>:<serviceaccount>' };
    default:
      return null;
  }
}

export const federatedIdentityCredentialHclGenerator: HclGenerator = {
  typeId: 'azurerm/identity/federated_identity_credential',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const audiences = (props['audience'] as string[] | undefined) ?? [DEFAULT_AUDIENCE];

    const resolved = resolvePreset(props);
    const issuer = resolved?.issuer ?? ((props['issuer'] as string) ?? '');
    const subject = resolved?.subject ?? ((props['subject'] as string) ?? '');

    const rgExpr = context.getResourceGroupExpression(resource);

    const parentRef = resource.references['parent_id'];
    const parentIdExpr = parentRef
      ? context.getAttributeReference(parentRef, 'id')
      : '"<managed-identity-id>"';
    const dependsOn: string[] = [];
    if (parentRef) {
      const addr = context.getTerraformAddress(parentRef);
      if (addr) dependsOn.push(addr);
    }

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const issuerExpr = resolved
      ? `"${e(issuer)}"`
      : context.getPropertyExpression(resource, 'issuer', issuer);
    const subjectExpr = resolved
      ? `"${e(subject)}"`
      : context.getPropertyExpression(resource, 'subject', subject);

    const audienceLiteral = `[${audiences.map((a) => `"${e(a)}"`).join(', ')}]`;

    const lines: string[] = [
      `resource "azurerm_federated_identity_credential" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  parent_id           = ${parentIdExpr}`,
      `  audience            = ${audienceLiteral}`,
      `  issuer              = ${issuerExpr}`,
      `  subject             = ${subjectExpr}`,
      `}`,
    ];

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_federated_identity_credential',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
