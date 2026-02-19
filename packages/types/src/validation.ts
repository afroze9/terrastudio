export interface ValidationError {
  readonly propertyKey: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface PropertyValidation {
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly min?: number;
  readonly max?: number;
  readonly pattern?: string;
  readonly patternMessage?: string;
  readonly customValidator?: string;
}
