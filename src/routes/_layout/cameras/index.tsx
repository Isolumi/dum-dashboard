import { createFileRoute } from "@tanstack/react-router";

import { CameraPlayer } from "./-CameraPlayer";

export const Route = createFileRoute("/_layout/cameras/")({
  component: CamerasPage,
});

function CamerasPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Cameras</h1>
      <CameraPlayer stream="camera-high" label="Camera" className="w-full" />
    </main>
  );
}
