import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/** Matches the existing workspace sidebar breakpoint without changing mobile. */
export function useIsLaptop() {
  const [isLaptop, setIsLaptop] = React.useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1280px) and (pointer: fine)").matches);
  React.useEffect(() => {
    const mql = window.matchMedia("(min-width: 1280px) and (pointer: fine)");
    const update = () => setIsLaptop(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return isLaptop;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
