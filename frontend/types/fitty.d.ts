declare module 'fitty' {
  interface FittyOptions {
    minSize?: number;
    maxSize?: number;
    multiLine?: boolean;
    observeMutations?: false | MutationObserverInit;
  }

  interface FittyInstance {
    element: HTMLElement;
    fit: () => void;
    unsubscribe: () => void;
  }

  function fitty(
    el: HTMLElement,
    options?: FittyOptions
  ): FittyInstance;

  export default fitty;
}
