import { DropdownOption } from '../dropdown/dropdown';
import { GridColumn } from '../grid/grid';

export type FilterMatch = 'contains' | 'digits' | 'equals';

export type FilterValues = Record<string, string>;

// `match` and `value` are used by filterRows (client-side filtering). Pages
// that filter on the server only use the values emitted by the component.
export interface FilterField<T> {
  id: string;
  label: string;
  match?: FilterMatch;
  value?: (row: T) => string | string[] | null | undefined;
  type?: 'text' | 'date' | 'tel' | 'email' | 'select' | 'finder';
  options?: DropdownOption[];
  finder?: FilterFinder<any>;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email';
  placeholder?: string;
  fullWidth?: boolean;
}

export function filterRows<T>(rows: T[], fields: FilterField<T>[], values: FilterValues): T[] {
  const criteria = fields.filter((field) => values[field.id] && field.value);

  if (criteria.length === 0) {
    return rows;
  }

  return rows.filter((row) =>
    criteria.every((field) => matchesField(field.value!(row), values[field.id], field.match ?? 'contains'))
  );
}

function matchesField(rawValue: string | string[] | null | undefined, query: string, match: FilterMatch): boolean {
  const values = (Array.isArray(rawValue) ? rawValue : [rawValue ?? '']).map((value) => value ?? '');

  switch (match) {
    case 'digits': {
      const digits = query.replace(/\D/g, '');
      return digits.length > 0 && values.some((value) => value.replace(/\D/g, '').includes(digits));
    }
    case 'equals':
      return values.some((value) => value === query);
    default: {
      const text = query.toLocaleLowerCase();
      return values.some((value) => value.toLocaleLowerCase().includes(text));
    }
  }
}

// Configuration of a 'finder' field: the value is the ID of the record chosen
// in a finder dialog (see components/finder).
export interface FilterFinder<I> {
  title: string;
  items: I[];
  columns: GridColumn<I>[];
  searchFields: FilterField<I>[];
  itemId: (item: I) => string;
  itemLabel: (item: I) => string;
  emptyMessage?: string;
}
