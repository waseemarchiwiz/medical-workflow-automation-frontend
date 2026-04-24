import { Link } from "react-router-dom";

import { appRoutes } from "@/app/routes/paths";
import { buttonVariants } from "@/shared/components/ui/button.styles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-xl border-white/50 bg-[var(--card)] shadow-[var(--shadow)] backdrop-blur-xl">
        <CardHeader>
          <CardTitle
            className="text-3xl tracking-[-0.03em] text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Page not found
          </CardTitle>
          <CardDescription className="mt-2 text-base leading-7 text-[var(--muted)]">
            The route you requested does not exist in this frontend. Use the
            workflow route below to get back into the application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            className={buttonVariants({ size: "lg" })}
            to={appRoutes.workflow}
          >
            Open workflow
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default NotFoundPage;
