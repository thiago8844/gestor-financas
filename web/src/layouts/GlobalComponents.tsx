import { Overlay } from "../components/Overlay";
import { ConfirmModal } from "../components/ConfirmModal";

/**
 * 
 * @returns Components globais do zustand
 */
export function GlobalComponents() {
  return (
    <>
      <Overlay />
      <ConfirmModal/>
    </>
  );
}
