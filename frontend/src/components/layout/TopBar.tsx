import BurgerMenu from "./BurgerMenu";

export default function TopBar() {
  return (
    <header className="fixed top-0 inset-x-0 z-40 h-14 flex items-center gap-3 px-3 bg-primary text-primary-foreground shadow-md">
      <BurgerMenu />
      <span className="text-sm font-semibold tracking-wide select-none">
        Savanna Sentinel
      </span>
    </header>
  );
}
