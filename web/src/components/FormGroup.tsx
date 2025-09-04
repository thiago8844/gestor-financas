import type { ReactNode } from "react";

export function FormGroup({label, id, children}: {label: string, id: string, children: ReactNode}) {
  return (
    <div className="mb-3">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      {children}
    </div>
  );
}
