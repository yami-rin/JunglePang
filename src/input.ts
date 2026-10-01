import type { Animal } from "./engine";

/** Each fresh pointer-down counts once; click compatibility events never count twice. */
export function bindInputs(
  buttons: Record<Animal, HTMLButtonElement>,
  accepts: () => boolean,
  onInput: (animal: Animal) => void,
): () => void {
  const abort = new AbortController();
  const options = { signal: abort.signal };
  const pointers = new Set<number>();
  const keys = new Set<string>();
  const keyMap: Record<string, Animal> = {
    ArrowLeft: "monkey",
    KeyA: "monkey",
    ArrowRight: "tiger",
    KeyD: "tiger",
  };
  for (const animal of ["monkey", "tiger"] as const) {
    const button = buttons[animal];
    button.addEventListener(
      "pointerdown",
      (event) => {
        if (!accepts() || event.button !== 0 || pointers.has(event.pointerId))
          return;
        event.preventDefault();
        pointers.add(event.pointerId);
        onInput(animal);
      },
      options,
    );
    // Native button activation (Enter, Space, assistive technology).
    button.addEventListener(
      "click",
      (event) => {
        if (event.detail === 0 && accepts()) onInput(animal);
      },
      options,
    );
    button.addEventListener(
      "contextmenu",
      (event) => event.preventDefault(),
      options,
    );
  }
  const release = (event: PointerEvent) => pointers.delete(event.pointerId);
  window.addEventListener("pointerup", release, options);
  window.addEventListener("pointercancel", release, options);
  window.addEventListener(
    "keydown",
    (event) => {
      const nativeButton =
        event.code === "Enter" || event.code === "Space"
          ? event.target === buttons.monkey
            ? "monkey"
            : event.target === buttons.tiger
              ? "tiger"
              : undefined
          : undefined;
      const animal = keyMap[event.code] ?? nativeButton;
      if (
        !animal ||
        !accepts() ||
        (event.target instanceof Element &&
          event.target.closest("input, textarea, select, dialog"))
      )
        return;
      event.preventDefault();
      if (event.repeat || keys.has(event.code)) return;
      keys.add(event.code);
      onInput(animal);
    },
    options,
  );
  window.addEventListener("keyup", (event) => keys.delete(event.code), options);
  window.addEventListener(
    "blur",
    () => {
      keys.clear();
      pointers.clear();
    },
    options,
  );
  return () => abort.abort();
}
