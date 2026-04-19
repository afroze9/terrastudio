import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

interface EmailReceiver {
  name: string;
  email_address: string;
  use_common_alert_schema?: boolean;
}

interface SmsReceiver {
  name: string;
  country_code: string;
  phone_number: string;
}

interface WebhookReceiver {
  name: string;
  service_uri: string;
  use_common_alert_schema?: boolean;
}

export const actionGroupHclGenerator: HclGenerator = {
  typeId: 'azurerm/monitoring/action_group',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const shortName = (props['short_name'] as string) ?? 'action';
    const enabled = props['enabled'] as boolean | undefined;
    const emailReceivers = (props['email_receivers'] as EmailReceiver[] | undefined) ?? [];
    const smsReceivers = (props['sms_receivers'] as SmsReceiver[] | undefined) ?? [];
    const webhookReceivers = (props['webhook_receivers'] as WebhookReceiver[] | undefined) ?? [];

    const rgExpr = context.getResourceGroupExpression(resource);
    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const shortNameExpr = context.getPropertyExpression(resource, 'short_name', shortName);

    const lines: string[] = [
      `resource "azurerm_monitor_action_group" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  short_name          = ${shortNameExpr}`,
    ];

    if (enabled === false || resource.variableOverrides?.['enabled'] === 'variable') {
      const enabledExpr = context.getPropertyExpression(resource, 'enabled', enabled ?? true);
      lines.push(`  enabled             = ${enabledExpr}`);
    }

    for (const r of emailReceivers) {
      lines.push('');
      lines.push('  email_receiver {');
      lines.push(`    name                    = "${e(r.name)}"`);
      lines.push(`    email_address           = "${e(r.email_address)}"`);
      if (r.use_common_alert_schema !== undefined) {
        lines.push(`    use_common_alert_schema = ${r.use_common_alert_schema}`);
      }
      lines.push('  }');
    }

    for (const r of smsReceivers) {
      lines.push('');
      lines.push('  sms_receiver {');
      lines.push(`    name         = "${e(r.name)}"`);
      lines.push(`    country_code = "${e(r.country_code)}"`);
      lines.push(`    phone_number = "${e(r.phone_number)}"`);
      lines.push('  }');
    }

    for (const r of webhookReceivers) {
      lines.push('');
      lines.push('  webhook_receiver {');
      lines.push(`    name                    = "${e(r.name)}"`);
      lines.push(`    service_uri             = "${e(r.service_uri)}"`);
      if (r.use_common_alert_schema !== undefined) {
        lines.push(`    use_common_alert_schema = ${r.use_common_alert_schema}`);
      }
      lines.push('  }');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_monitor_action_group',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
