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
- Streaming file upload — files are piped directly to disk, no in-memory buffering regardless of file size
- Drag-and-drop upload with folder structure preservation (handles folders with >100 files)
- Real-time per-file upload progress via XHR
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
| Upload parsing | busboy (streaming multipart) |
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
  upload/route.ts   # POST — streaming upload (busboy → createWriteStream, no buffering)

components/file-manager/
  file-browser.tsx       # Main component — state, navigation, all operations
  file-icon.tsx          # Type-aware file/folder icons
  toolbar.tsx            # New Folder, Upload, Delete, Refresh actions
  upload-zone.tsx        # Drag-and-drop overlay (files + folder trees)
  upload-queue.tsx       # Fixed progress panel (top-right)
  rename-dialog.tsx      # Rename modal
  new-folder-dialog.tsx  # New folder modal

lib/
  fs.ts       # ROOT_DIR resolution + path traversal guard
  upload.ts   # XHR upload helper + formatting utilities
  types.ts    # Shared TypeScript types

k8s/
  namespace.yaml             # filemanager namespace
  pvc.yaml                   # PersistentVolumeClaim
  deployment.yaml            # Deployment with PVC volume mount
  service.yaml               # ClusterIP Service
  ingress.yaml               # Ingress with unlimited body size + timeout annotations
  nginx-configmap-patch.yaml # Global nginx ConfigMap patch (proxy buffering + body size)
```

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `MOUNT_PATH` | `/data` | Path inside the container where the PVC is mounted |

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

### 1. PVC

Edit `k8s/pvc.yaml` — set `storageClassName` and `storage` to match your cluster.

**Longhorn users:** the PVC uses `ReadWriteOnce` (RWO) by default. Longhorn implements `ReadWriteMany` (RWX) via an NFS share-manager pod which adds significant write overhead. Since this app runs as a single replica, RWO with direct iSCSI gives much better throughput. Only use RWX if you need to share the volume with another pod simultaneously.

### 2. Deployment

Edit `k8s/deployment.yaml`:
- Update the `image:` field to your registry path
- Set `MOUNT_PATH` to your media root inside the container

**Resource recommendations:**
- CPU limit: `1000m` (1 vCPU) — prevents event loop throttling during sustained uploads
- Memory limit: `512Mi` — sufficient with streaming; upload size does not affect memory usage

### 3. Ingress

Edit `k8s/ingress.yaml` — set `ingressClassName` and `host` to match your homelab DNS.

The ingress sets `nginx.org/client-max-body-size: "0"` (unlimited) and `proxy_request_buffering off`. Both are required for large file uploads to work — without them nginx will reject or buffer the upload before it reaches the app.

If you see 413 errors despite the per-ingress annotation, also apply the global ConfigMap patch:

```bash
kubectl apply -f k8s/nginx-configmap-patch.yaml
```

### 4. Apply

```bash
kubectl apply -f k8s/
```

### Sharing a Jellyfin PVC

To manage files on an existing Jellyfin volume, replace the `claimName` in `deployment.yaml` with your Jellyfin PVC name and set `MOUNT_PATH` to the same path Jellyfin uses for its media library. Use `ReadWriteMany` on the PVC if both pods run on different nodes.
