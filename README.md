# K8s File Manager

A simple web-based file manager for Kubernetes homelabs. Mounts to a Persistent Volume Claim (PVC) and provides a browser-based interface for managing files and folders — built primarily for Jellyfin media management.

---

> **Disclaimer**
>
> This is a **personal homelab project**, generated with the assistance of AI (Claude by Anthropic). It is shared publicly as-is, without any guarantees of correctness, security, or fitness for a particular purpose.
>
> **Security vulnerabilities may be present.** This tool has no authentication, no authorization, and exposes direct filesystem access over HTTP. It is designed for use inside a private, trusted network (e.g., a home Kubernetes cluster behind a local ingress) and should **never** be exposed to the public internet.
>
> **Use at your own risk.** The author accepts no responsibility for data loss, unauthorized access, or any other issues arising from the use of this software.

---

## Features

- Browse files and folders on a PVC-mounted volume
- Create, rename, and delete files and folders
- Upload single files, multiple files, or entire folder trees
- Chunked file transfer (4 MB chunks) for reliable large-file uploads
- Drag-and-drop upload with folder structure preservation
- Download files directly from the browser
- File-type-aware icons (video, audio, image, archive, code, etc.)
- Upload progress queue with per-file status
- Responsive table layout with breadcrumb navigation
- Right-click context menu for quick actions

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, standalone output) |
| UI | shadcn/ui + Tailwind CSS |
| Icons | lucide-react |
| Notifications | Sonner |
| Container | Docker (single image, no sidecar) |
| Deployment | Kubernetes (Deployment + PVC + Service + Ingress) |

## Project Structure

```
app/api/files/
  route.ts          # GET  — list directory contents
  mkdir/route.ts    # POST — create folder
  rename/route.ts   # POST — rename file or folder
  delete/route.ts   # POST — delete one or more items
  download/route.ts # GET  — stream file download
  upload/route.ts   # POST — chunked upload endpoint

components/file-manager/
  file-browser.tsx       # Main component — state, navigation, all operations
  file-icon.tsx          # Type-aware file/folder icons
  toolbar.tsx            # New Folder, Upload, Delete, Refresh actions
  upload-zone.tsx        # Drag-and-drop overlay (files + folder trees)
  upload-queue.tsx       # Fixed progress panel (bottom-right)
  rename-dialog.tsx      # Rename modal
  new-folder-dialog.tsx  # New folder modal

lib/
  fs.ts       # ROOT_DIR resolution + path traversal guard
  upload.ts   # Chunked upload helper + formatting utilities
  types.ts    # Shared TypeScript types

k8s/
  pvc.yaml         # PersistentVolumeClaim
  deployment.yaml  # Deployment with PVC volume mount
  service.yaml     # ClusterIP Service
  ingress.yaml     # Ingress with large-body + timeout annotations
```

## Configuration

The mount path is controlled by the `MOUNT_PATH` environment variable. Set this in `k8s/deployment.yaml` to match wherever your PVC is mounted inside the container (default: `/data`).

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Files will be served from `./data` in the project root (created automatically).

## Docker Build

```bash
docker build -t ghcr.io/YOUR_USER/filemanager:latest .
docker push ghcr.io/YOUR_USER/filemanager:latest
```

## Kubernetes Deployment

1. Edit `k8s/pvc.yaml` — set `storageClassName` and `storage` to match your cluster, or replace `claimName` in the Deployment with your existing Jellyfin PVC name.
2. Edit `k8s/deployment.yaml` — update the `image:` field and set `MOUNT_PATH` to your media root.
3. Edit `k8s/ingress.yaml` — set `ingressClassName` and `host` to match your homelab DNS.

```bash
kubectl apply -f k8s/
```

To share the same volume as Jellyfin, point `claimName` in `deployment.yaml` at your existing Jellyfin PVC and set `MOUNT_PATH` to the same path Jellyfin uses for its media library.
