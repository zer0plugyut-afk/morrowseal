import { Link } from "react-router-dom";
import { Compass } from "@phosphor-icons/react";
import { CenterPage, Hero, btn } from "../components/ui";

export default function NotFound() {
  return (
    <CenterPage>
      <Hero icon={<Compass size={30} weight="duotone" />} />
      <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Page not found</h1>
      <p className="max-w-sm text-pretty text-muted-foreground">That link doesn't lead anywhere. If it came from an email, open the button in the email again.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3"><Link to="/" className={btn("primary", "md")}>Back home</Link><Link to="/app" className={btn("secondary", "md")}>Your vaults</Link></div>
    </CenterPage>
  );
}
