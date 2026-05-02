import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";

import { AppLayout } from "@/app/layouts/app-layout";
import { appRouteSegments, appRoutes } from "@/app/routes/paths";
import NotFoundPage from "@/pages/not-found-page";
import SoapWorkflowPage from "@/pages/soap-workflow-page";
import AmbientRecordingPage from "@/pages/ambient-recording-page";

const router = createBrowserRouter([
  {
    path: appRoutes.home,
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate replace to={appRoutes.ambientRecording} />,
      },
      {
        path: appRouteSegments.workflow,
        element: <SoapWorkflowPage />,
      },
      {
        path: appRouteSegments.ambientRecording,
        element: <AmbientRecordingPage />,
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
