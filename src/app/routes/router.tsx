import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";

import { AppLayout } from "@/app/layouts/app-layout";
import { appRouteSegments, appRoutes } from "@/app/routes/paths";
import NotFoundPage from "@/pages/not-found-page";
import SoapWorkflowPage from "@/pages/soap-workflow-page";

const router = createBrowserRouter([
  {
    path: appRoutes.home,
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate replace to={appRoutes.workflow} />,
      },
      {
        path: appRouteSegments.workflow,
        element: <SoapWorkflowPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);

function AppRouter() {
  return <RouterProvider router={router} />;
}

export { AppRouter };
