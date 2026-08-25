import { useEffect, useRef, type RefObject } from "react";

// react-dom's useFormState resolves to the same `undefined` both on
// initial render and after a successful submission (these create actions
// return nothing on success) — so watching `state` alone can't tell a
// fresh mount apart from "just submitted successfully". `pending`'s
// true -> false transition is the only reliable signal, so this has to
// live in a component that calls useFormStatus() (a descendant of the
// <form>, not the form's own parent).
export function useResetFormOnSuccess(
  formRef: RefObject<HTMLFormElement>,
  pending: boolean,
  hasError: boolean
) {
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !hasError) {
      formRef.current?.reset();
    }
    wasPending.current = pending;
  }, [pending, hasError, formRef]);
}
