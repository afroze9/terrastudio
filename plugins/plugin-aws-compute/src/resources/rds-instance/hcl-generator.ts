import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const rdsInstanceHclGenerator: HclGenerator = {
  typeId: 'aws/compute/rds_instance',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const engine = (props['engine'] as string) ?? 'postgres';
    const engineVersion = props['engine_version'] as string | undefined;
    const instanceClass = (props['instance_class'] as string) ?? 'db.t3.micro';
    const allocatedStorage = props['allocated_storage'] as number ?? 20;
    const storageType = (props['storage_type'] as string) ?? 'gp3';
    const dbName = props['db_name'] as string | undefined;
    const username = (props['username'] as string) ?? 'admin';
    const password = (props['password'] as string) ?? '';
    const multiAz = props['multi_az'] as boolean ?? false;
    const publiclyAccessible = props['publicly_accessible'] as boolean ?? false;
    const skipFinalSnapshot = props['skip_final_snapshot'] as boolean ?? true;

    const dependsOn: string[] = [];

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const engineExpr = context.getPropertyExpression(resource, 'engine', engine);
    const instanceClassExpr = context.getPropertyExpression(resource, 'instance_class', instanceClass);
    const allocatedStorageExpr = context.getPropertyExpression(resource, 'allocated_storage', allocatedStorage);
    const storageTypeExpr = context.getPropertyExpression(resource, 'storage_type', storageType);
    const usernameExpr = context.getPropertyExpression(resource, 'username', username);
    const passwordExpr = context.getPropertyExpression(resource, 'password', password);
    const multiAzExpr = context.getPropertyExpression(resource, 'multi_az', multiAz);
    const publiclyAccessibleExpr = context.getPropertyExpression(resource, 'publicly_accessible', publiclyAccessible);
    const skipFinalSnapshotExpr = context.getPropertyExpression(resource, 'skip_final_snapshot', skipFinalSnapshot);

    const lines: string[] = [
      `resource "aws_db_instance" "${resource.terraformName}" {`,
      `  identifier          = ${nameExpr}`,
      `  engine              = ${engineExpr}`,
    ];

    // Engine version (optional)
    if (engineVersion || resource.variableOverrides?.['engine_version'] === 'variable') {
      const engineVersionExpr = context.getPropertyExpression(resource, 'engine_version', engineVersion ?? '');
      lines.push(`  engine_version      = ${engineVersionExpr}`);
    }

    lines.push(`  instance_class      = ${instanceClassExpr}`);
    lines.push(`  allocated_storage   = ${allocatedStorageExpr}`);
    lines.push(`  storage_type        = ${storageTypeExpr}`);

    // Database name (optional)
    if (dbName || resource.variableOverrides?.['db_name'] === 'variable') {
      const dbNameExpr = context.getPropertyExpression(resource, 'db_name', dbName ?? '');
      lines.push(`  db_name             = ${dbNameExpr}`);
    }

    lines.push(`  username            = ${usernameExpr}`);
    lines.push(`  password            = ${passwordExpr}`);
    lines.push(`  multi_az            = ${multiAzExpr}`);
    lines.push(`  publicly_accessible = ${publiclyAccessibleExpr}`);
    lines.push(`  skip_final_snapshot = ${skipFinalSnapshotExpr}`);

    // Security group reference
    const sgRef = resource.references['security_group_ids'];
    if (sgRef) {
      const sgIdExpr = context.getAttributeReference(sgRef, 'id');
      lines.push('');
      lines.push(`  vpc_security_group_ids = [${sgIdExpr}]`);
      const sgAddr = context.getTerraformAddress(sgRef);
      if (sgAddr) dependsOn.push(sgAddr);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_db_instance',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
