export function observeViewport(view, element) {
  const viewport = view.visualViewport;
  const update = () => {
    element.style.setProperty(
      "--cria-app-height",
      `${viewport?.height ?? view.innerHeight}px`
    );
  };
  update();
  view.addEventListener("resize", update);
  viewport?.addEventListener("resize", update);
  return () => {
    view.removeEventListener("resize", update);
    viewport?.removeEventListener("resize", update);
    element.style.removeProperty("--cria-app-height");
  };
}
