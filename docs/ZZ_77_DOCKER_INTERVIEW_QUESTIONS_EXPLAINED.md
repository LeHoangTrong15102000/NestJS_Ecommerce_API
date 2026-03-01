# 🐳 CÂU HỎI PHỎNG VẤN DOCKER - GIẢI THÍCH CHI TIẾT CHUYÊN SÂU

> **Tài liệu này phân tích và giải thích chi tiết 5 câu hỏi phỏng vấn Docker phổ biến nhất, dựa trên kiến thức từ tài liệu chính thức của Docker (docs.docker.com) và cộng đồng chuyên gia.**

---

## 📋 MỤC LỤC

1. [Docker là gì? (What is Docker?)](#câu-1-docker-là-gì-what-is-docker)
2. [Docker Container là gì? (What is a Docker Container?)](#câu-2-docker-container-là-gì-what-is-a-docker-container)
3. [Mục đích của Docker Image là gì? (What is the purpose of a Docker Image?)](#câu-3-mục-đích-của-docker-image-là-gì-what-is-the-purpose-of-a-docker-image)
4. [Cách tạo một Dockerfile? (How do you create a Dockerfile?)](#câu-4-cách-tạo-một-dockerfile-how-do-you-create-a-dockerfile)
5. [Sự khác biệt giữa CMD và ENTRYPOINT? (What is the difference between CMD and ENTRYPOINT?)](#câu-5-sự-khác-biệt-giữa-cmd-và-entrypoint-what-is-the-difference-between-cmd-and-entrypoint)

---

## Câu 1: Docker là gì? (What is Docker?)

### 1.1. Định Nghĩa Chính Thức

Theo **tài liệu chính thức của Docker** (docs.docker.com):

> **Docker là một nền tảng mở (open platform) để phát triển (developing), vận chuyển (shipping) và chạy (running) các ứng dụng.** Docker cho phép bạn tách biệt ứng dụng khỏi hạ tầng (infrastructure) để có thể phân phối phần mềm một cách nhanh chóng.

Nói một cách đơn giản hơn, Docker là một công nghệ **containerization** (đóng gói ứng dụng vào container) cho phép bạn đóng gói toàn bộ ứng dụng cùng với tất cả các dependencies (thư viện, runtime, system tools, cấu hình) vào một đơn vị tiêu chuẩn gọi là **container**. Container này có thể chạy nhất quán trên bất kỳ môi trường nào có cài Docker.

### 1.2. Kiến Trúc Docker (Docker Architecture)

Docker sử dụng kiến trúc **client-server** với các thành phần chính sau:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      DOCKER ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   🖥️ Docker Client          REST API          🔧 Docker Daemon      │
│   (docker CLI)        ──────────────►        (dockerd)               │
│                                                                      │
│   Lệnh người dùng:                          Quản lý:                │
│   • docker build                             • Images                │
│   • docker pull                              • Containers            │
│   • docker run                               • Networks              │
│   • docker push                              • Volumes               │
│                                                                      │
│                              ↕                                       │
│                                                                      │
│                    🏪 Docker Registry                                │
│                    (Docker Hub, ECR, GCR, ACR...)                    │
│                    • Lưu trữ Docker Images                          │
│                    • Public & Private registries                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### **🔹 Docker Daemon (dockerd)**

- Là tiến trình chạy nền (background process) quản lý tất cả các Docker objects
- Lắng nghe các Docker API requests từ Docker Client
- Quản lý images, containers, networks, và volumes
- Có thể giao tiếp với các daemon khác để quản lý Docker services (trong Docker Swarm)

#### **🔹 Docker Client (docker)**

- Là giao diện chính mà người dùng tương tác với Docker thông qua CLI (Command Line Interface)
- Gửi các lệnh như `docker run`, `docker build`, `docker pull` đến Docker Daemon thông qua REST API
- Có thể giao tiếp với nhiều daemon cùng lúc

#### **🔹 Docker Registry**

- Nơi lưu trữ Docker images
- **Docker Hub** là registry công khai mặc định (giống npm registry cho Node.js)
- Có thể tự host private registry riêng
- Các cloud provider cung cấp registry riêng: **ECR** (AWS), **ACR** (Azure), **GCR** (Google Cloud)

### 1.3. Docker vs Virtual Machine (Máy Ảo)

Đây là câu hỏi phụ rất hay được hỏi thêm trong phỏng vấn:

```
┌──────────────────────────────────────────────────────────────────┐
│              DOCKER CONTAINERS vs VIRTUAL MACHINES                │
├──────────────────────────┬───────────────────────────────────────┤
│     CONTAINERS           │        VIRTUAL MACHINES               │
├──────────────────────────┼───────────────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌────┐ │  ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │App A│ │App B│ │App C│ │  │  App A  │ │  App B  │ │ App C  │ │
│  ├─────┤ ├─────┤ ├────┤ │  ├─────────┤ ├─────────┤ ├────────┤ │
│  │Bins/│ │Bins/│ │Bins│ │  │ Bins/   │ │ Bins/   │ │ Bins/  │ │
│  │Libs │ │Libs │ │Libs│ │  │ Libs    │ │ Libs    │ │ Libs   │ │
│  └──┬──┘ └──┬──┘ └─┬──┘ │  ├─────────┤ ├─────────┤ ├────────┤ │
│     └───────┼───────┘    │  │Guest OS │ │Guest OS │ │Guest OS│ │
│    ┌────────┴────────┐   │  └────┬────┘ └────┬────┘ └───┬────┘ │
│    │  Docker Engine  │   │       └───────────┼──────────┘      │
│    ├─────────────────┤   │       ┌───────────┴──────────┐      │
│    │    Host OS      │   │       │     Hypervisor       │      │
│    ├─────────────────┤   │       ├──────────────────────┤      │
│    │   Hardware      │   │       │      Host OS         │      │
│    └─────────────────┘   │       ├──────────────────────┤      │
│                          │       │     Hardware         │      │
│                          │       └──────────────────────┘      │
└──────────────────────────┴───────────────────────────────────────┘
```

| Tiêu chí | Docker Container | Virtual Machine |
|-----------|-----------------|-----------------|
| **Kiến trúc** | Chia sẻ kernel của Host OS, chạy như các tiến trình cô lập | Mỗi VM có một bản sao đầy đủ của OS với kernel riêng |
| **Kích thước** | Nhẹ (MB) - thường 10-200MB | Nặng (GB) - thường 1-10GB |
| **Thời gian khởi động** | Rất nhanh (giây) | Chậm (phút) |
| **Hiệu suất** | Gần như native, overhead rất thấp | Overhead đáng kể do hypervisor |
| **Mức độ cô lập** | Cô lập ở mức process (namespaces, cgroups) | Cô lập ở mức hardware (hypervisor) |
| **Tính di động** | Rất cao - "Build once, run anywhere" | Thấp hơn do phụ thuộc hypervisor |
| **Bảo mật** | Chia sẻ kernel → bề mặt tấn công lớn hơn | Kernel riêng → cô lập tốt hơn |
| **Use case** | Microservices, CI/CD, dev environment | Legacy apps, cần OS khác nhau |

### 1.4. Khái Niệm Containerization

**Containerization** (đóng gói container) là phương pháp đóng gói ứng dụng cùng với tất cả dependencies vào các đơn vị tiêu chuẩn gọi là container:

- **Isolation (Cô lập)**: Mỗi container chạy trong môi trường cô lập riêng
- **Consistency (Nhất quán)**: Hành vi giống nhau trên mọi môi trường (dev, staging, production)
- **Efficiency (Hiệu quả)**: Chia sẻ kernel của Host OS, không cần OS riêng cho mỗi ứng dụng
- **Portability (Di động)**: Chạy nhất quán trên mọi nền tảng có Docker

> 💡 **Ghi nhớ cho phỏng vấn**: Docker giải quyết vấn đề kinh điển **"Works on my machine"** bằng cách đảm bảo môi trường chạy ứng dụng luôn nhất quán, bất kể chạy trên máy dev, server staging hay production.

---



## Câu 2: Docker Container là gì? (What is a Docker Container?)

### 2.1. Định Nghĩa Chính Thức

Theo **tài liệu chính thức của Docker**:

> **Container là một instance có thể chạy được (runnable instance) của một image.** Nó là một đơn vị phần mềm tiêu chuẩn đóng gói code và tất cả dependencies để ứng dụng chạy nhanh chóng và đáng tin cậy trên mọi môi trường.

Nói cách khác, nếu **Docker Image** là "bản thiết kế" (blueprint), thì **Container** chính là "ngôi nhà" được xây từ bản thiết kế đó. Bạn có thể tạo nhiều container (nhiều ngôi nhà) từ cùng một image (cùng một bản thiết kế).

### 2.2. Vòng Đời Container (Container Lifecycle)

Container trải qua nhiều trạng thái trong vòng đời của nó:

```
                    docker create
                         │
                         ▼
    ┌─────────────────────────────────────────┐
    │              CREATED                     │
    │         (Đã tạo, chưa chạy)             │
    └──────────────┬──────────────────────────┘
                   │ docker start
                   ▼
    ┌─────────────────────────────────────────┐
    │              RUNNING                     │◄──── docker restart
    │           (Đang chạy)                    │
    └──┬───────────┬──────────────┬───────────┘
       │           │              │
       │ docker    │ docker       │ docker stop /
       │ pause     │ kill         │ container exits
       ▼           │              ▼
    ┌──────────┐   │    ┌─────────────────────┐
    │ PAUSED   │   │    │     STOPPED          │
    │(Tạm dừng)│   │    │   (Đã dừng)          │
    └──┬───────┘   │    └──────────┬──────────┘
       │           │               │
       │ docker    │               │ docker rm
       │ unpause   │               ▼
       │           │    ┌─────────────────────┐
       └───────────┘    │     REMOVED          │
                        │    (Đã xóa)          │
                        └─────────────────────┘
```

**Các trạng thái chính:**

| Trạng thái | Mô tả | Lệnh liên quan |
|------------|--------|----------------|
| **Created** | Container đã được tạo nhưng chưa khởi động | `docker create` |
| **Running** | Container đang chạy và thực thi processes | `docker start`, `docker run` |
| **Paused** | Các processes trong container bị tạm dừng | `docker pause` |
| **Stopped** | Container đã dừng (exit) | `docker stop`, `docker kill` |
| **Removed** | Container đã bị xóa hoàn toàn | `docker rm` |

**Ví dụ thực tế:**

```bash
# Tạo và chạy container (docker run = docker create + docker start)
docker run -d --name my-nginx -p 8080:80 nginx:alpine

# Xem trạng thái container
docker ps                    # Chỉ hiện container đang chạy
docker ps -a                 # Hiện tất cả container (kể cả đã dừng)

# Tạm dừng container
docker pause my-nginx

# Tiếp tục chạy
docker unpause my-nginx

# Dừng container (gửi SIGTERM, chờ 10s, rồi SIGKILL)
docker stop my-nginx

# Khởi động lại
docker start my-nginx

# Xóa container (phải stop trước)
docker stop my-nginx && docker rm my-nginx

# Hoặc force remove
docker rm -f my-nginx
```

### 2.3. Container vs Image

| Khía cạnh | Image | Container |
|-----------|-------|-----------|
| **Bản chất** | Template chỉ đọc (read-only) | Instance có thể chạy được |
| **Tính thay đổi** | Bất biến (immutable) | Có thể thay đổi (mutable) tại runtime |
| **Mục đích** | Bản thiết kế để tạo container | Ứng dụng đang chạy |
| **Lưu trữ** | Lưu trong registry | Chạy trên host machine |
| **Layers** | Gồm nhiều layers chỉ đọc | Thêm 1 writable layer phía trên |
| **Tương tự** | Class trong OOP | Object (instance) trong OOP |

```
┌─────────────────────────────────────────────────┐
│                  CONTAINER                       │
│  ┌─────────────────────────────────────────────┐ │
│  │     Writable Container Layer (R/W)          │ │ ← Thay đổi tại runtime
│  ├─────────────────────────────────────────────┤ │
│  │     Image Layer 4 - App Code (R/O)          │ │
│  ├─────────────────────────────────────────────┤ │
│  │     Image Layer 3 - Dependencies (R/O)      │ │ ← Image layers
│  ├─────────────────────────────────────────────┤ │    (chỉ đọc)
│  │     Image Layer 2 - Runtime (R/O)           │ │
│  ├─────────────────────────────────────────────┤ │
│  │     Image Layer 1 - Base OS (R/O)           │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 2.4. Cơ Chế Cô Lập: Namespaces và Cgroups

Đây là phần kiến thức **rất quan trọng** trong phỏng vấn, vì nó giải thích **cách Docker thực sự hoạt động** ở mức hệ điều hành.

#### **🔹 Linux Namespaces (Cơ chế cô lập)**

Docker sử dụng **Linux Namespaces** để tạo ra môi trường cô lập cho mỗi container. Mỗi container có một bộ namespaces riêng:

| Namespace | Chức năng | Ví dụ |
|-----------|-----------|-------|
| **PID** | Cô lập Process ID | Container chỉ thấy processes của chính nó |
| **NET** | Cô lập Network | Container có network interface, IP riêng |
| **IPC** | Cô lập Inter-Process Communication | Container không thể giao tiếp IPC với container khác |
| **MNT** | Cô lập Filesystem Mount Points | Container có filesystem riêng |
| **UTS** | Cô lập Hostname và Domain | Container có hostname riêng |
| **USER** | Cô lập User và Group ID | Root trong container ≠ Root trên host |

#### **🔹 Control Groups - cgroups (Quản lý tài nguyên)**

**Cgroups** giới hạn và quản lý tài nguyên mà mỗi container có thể sử dụng:

```bash
# Giới hạn memory cho container
docker run -d --memory="512m" --memory-swap="1g" nginx

# Giới hạn CPU
docker run -d --cpus="1.5" nginx          # Tối đa 1.5 CPU cores
docker run -d --cpu-shares=512 nginx       # Chia sẻ CPU theo tỷ lệ

# Giới hạn disk I/O
docker run -d --device-read-bps /dev/sda:1mb nginx
```

**Tại sao cgroups quan trọng?**
- Ngăn một container chiếm hết tài nguyên hệ thống
- Đảm bảo phân chia tài nguyên công bằng giữa các container
- Bảo vệ khỏi tấn công Denial-of-Service (DoS)
- Thiết yếu cho môi trường multi-tenant (nhiều khách hàng trên cùng server)

#### **🔹 Các cơ chế bảo mật bổ sung**

Ngoài namespaces và cgroups, Docker còn sử dụng:

- **Capabilities**: Kiểm soát quyền hạn chi tiết (không cần full root)
- **AppArmor/SELinux**: Profiles bảo mật bổ sung
- **Seccomp**: Lọc system calls mà container được phép gọi
- **User Namespaces**: Map root trong container thành non-root trên host

> 💡 **Ghi nhớ cho phỏng vấn**: Container KHÔNG phải là máy ảo. Container là các **tiến trình cô lập** chạy trên cùng kernel của Host OS, được cô lập bằng **namespaces** và giới hạn tài nguyên bằng **cgroups**.

---

## Câu 3: Mục đích của Docker Image là gì? (What is the purpose of a Docker Image?)

### 3.1. Định Nghĩa Chính Thức

Theo **tài liệu chính thức của Docker**:

> **Image là một template chỉ đọc (read-only template) chứa các instructions để tạo Docker container.** Images thường được xây dựng dựa trên các images khác với các tùy chỉnh bổ sung.

**Mục đích chính của Docker Image:**

1. **Đóng gói ứng dụng**: Gói toàn bộ code, runtime, libraries, dependencies vào một đơn vị duy nhất
2. **Tính nhất quán**: Đảm bảo ứng dụng chạy giống nhau trên mọi môi trường
3. **Tính di động**: Dễ dàng chia sẻ và phân phối qua Docker Registry
4. **Versioning**: Quản lý phiên bản ứng dụng thông qua image tags
5. **Tái sử dụng**: Các layers được chia sẻ giữa nhiều images, tiết kiệm dung lượng

### 3.2. Image Layers (Các tầng của Image)

Đây là khái niệm **cốt lõi** để hiểu Docker Image hoạt động như thế nào.

**Mỗi instruction trong Dockerfile tạo ra một layer mới.** Các layers được xếp chồng lên nhau:

```
┌─────────────────────────────────────────────────────────┐
│  Layer 5: COPY . /app                    (App source)    │  ← Thay đổi thường xuyên
│  ─────────────────────────────────────────────────────── │
│  Layer 4: RUN npm ci                     (Dependencies)  │  ← Thay đổi khi thêm package
│  ─────────────────────────────────────────────────────── │
│  Layer 3: COPY package*.json ./          (Package files)  │
│  ─────────────────────────────────────────────────────── │
│  Layer 2: WORKDIR /app                   (Working dir)   │  ← Ít thay đổi
│  ─────────────────────────────────────────────────────── │
│  Layer 1: FROM node:18-alpine            (Base image)    │  ← Rất ít thay đổi
└─────────────────────────────────────────────────────────┘
```

**Đặc điểm quan trọng của layers:**

- Mỗi layer là **bất biến (immutable)** sau khi được tạo
- Layers được **chia sẻ (shared)** giữa các images → tiết kiệm dung lượng
- Chỉ các layers **thay đổi** mới cần rebuild → tăng tốc build
- Docker sử dụng **cache** cho các layers không thay đổi

**Ví dụ minh họa cache layers:**

```dockerfile
# Dockerfile
FROM node:18-alpine          # Layer 1 - cached nếu không đổi base image
WORKDIR /app                  # Layer 2 - cached
COPY package*.json ./         # Layer 3 - cached nếu package.json không đổi
RUN npm ci                    # Layer 4 - cached nếu Layer 3 cached
COPY . .                      # Layer 5 - LUÔN rebuild khi code thay đổi
```

```bash
# Lần build đầu tiên - tất cả layers đều mới
$ docker build -t myapp:v1 .
Step 1/5 : FROM node:18-alpine
Step 2/5 : WORKDIR /app
Step 3/5 : COPY package*.json ./
Step 4/5 : RUN npm ci              # Mất 30 giây
Step 5/5 : COPY . .

# Lần build thứ 2 (chỉ thay đổi code, không thêm package)
$ docker build -t myapp:v2 .
Step 1/5 : FROM node:18-alpine     ---> Using cache ✅
Step 2/5 : WORKDIR /app            ---> Using cache ✅
Step 3/5 : COPY package*.json ./   ---> Using cache ✅
Step 4/5 : RUN npm ci              ---> Using cache ✅  # Không cần install lại!
Step 5/5 : COPY . .                # Chỉ layer này rebuild
```

> 💡 **Best Practice**: Sắp xếp Dockerfile từ **ít thay đổi → thay đổi thường xuyên** để tận dụng cache tối đa.

### 3.3. Union File System (Hệ thống file hợp nhất)

Docker sử dụng **Union File System (UnionFS)** để quản lý các layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    UNION FILE SYSTEM                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Người dùng/Container nhìn thấy:                           │
│   ┌─────────────────────────────────────┐                   │
│   │    Unified Filesystem View          │ ← Một filesystem  │
│   │    /app/server.js                   │    duy nhất        │
│   │    /app/package.json                │                    │
│   │    /usr/local/bin/node              │                    │
│   │    /etc/alpine-release              │                    │
│   └─────────────────────────────────────┘                   │
│                      ▲                                       │
│                      │ UnionFS hợp nhất                      │
│                      │                                       │
│   Thực tế bên dưới:                                         │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│   │ Layer 1  │ │ Layer 2  │ │ Layer 3  │ │ Layer 4  │      │
│   │ Base OS  │ │ Runtime  │ │ Deps     │ │ App Code │      │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Cách hoạt động:**

1. Mỗi layer được download và extract vào thư mục riêng
2. **UnionFS** xếp chồng các layers để tạo ra một view thống nhất
3. Khi container khởi động, root directory trỏ đến view thống nhất này
4. Container được thêm một **writable layer** phía trên
5. Các image layers gốc **không bị thay đổi**

**Copy-on-Write (CoW) Strategy:**

```
Khi container ĐỌC file:
  → Đọc trực tiếp từ image layers (nhanh, không tốn thêm dung lượng)

Khi container GHI/SỬA file:
  → Copy file từ image layer lên writable layer
  → Thực hiện thay đổi trên bản copy
  → Image layer gốc KHÔNG bị ảnh hưởng
```

Điều này cho phép **nhiều container chạy từ cùng một image** mà không ảnh hưởng lẫn nhau.

### 3.4. Quản Lý Images

```bash
# Xem danh sách images trên máy
docker images
docker image ls

# Pull image từ registry
docker pull nginx:alpine
docker pull node:18-alpine

# Build image từ Dockerfile
docker build -t myapp:v1 .
docker build -t myapp:v1 -f Dockerfile.prod .

# Tag image
docker tag myapp:v1 myregistry.com/myapp:v1

# Push image lên registry
docker push myregistry.com/myapp:v1

# Xem chi tiết layers của image
docker history myapp:v1

# Xem thông tin chi tiết image
docker inspect myapp:v1

# Xóa image
docker rmi myapp:v1
docker image prune          # Xóa images không sử dụng
docker image prune -a       # Xóa TẤT CẢ images không có container
```

### 3.5. Image Registries (Nơi lưu trữ Images)

| Registry | Loại | Mô tả |
|----------|------|--------|
| **Docker Hub** | Public/Private | Registry mặc định, lớn nhất thế giới |
| **Amazon ECR** | Private | AWS Elastic Container Registry |
| **Google GCR/Artifact Registry** | Private | Google Cloud Container Registry |
| **Azure ACR** | Private | Azure Container Registry |
| **GitHub Container Registry** | Public/Private | Tích hợp với GitHub |
| **Harbor** | Self-hosted | Open-source enterprise registry |
| **JFrog Artifactory** | Self-hosted | Enterprise artifact management |

**Cấu trúc tên image:**

```
registry.example.com/organization/repository:tag
│                     │              │          │
│                     │              │          └── Phiên bản (v1, latest, alpine)
│                     │              └── Tên image
│                     └── Tổ chức/namespace
└── Địa chỉ registry (mặc định: docker.io)

Ví dụ:
  docker.io/library/nginx:alpine     → nginx:alpine (rút gọn)
  ghcr.io/myorg/myapp:v2.1.0
  123456789.dkr.ecr.us-east-1.amazonaws.com/myapp:latest
```

> 💡 **Ghi nhớ cho phỏng vấn**: Docker Image giống như **"snapshot" bất biến** của ứng dụng. Nó sử dụng **layered architecture** với **Union File System** để tối ưu dung lượng và tốc độ build. Nhiều container có thể chạy từ cùng một image nhờ cơ chế **Copy-on-Write**.

---

## Câu 4: Cách tạo một Dockerfile? (How do you create a Dockerfile?)

### 4.1. Dockerfile là gì?

Theo **tài liệu chính thức của Docker**:

> **Dockerfile là một file văn bản (text file) chứa tất cả các lệnh (instructions) mà người dùng có thể gọi trên command line để tạo ra một image.** Docker có thể tự động build images bằng cách đọc các instructions từ Dockerfile.

Nói cách khác, Dockerfile là **"công thức nấu ăn"** (recipe) để Docker biết cách xây dựng image cho ứng dụng của bạn.

### 4.2. Cấu Trúc Cơ Bản của Dockerfile

Một Dockerfile cơ bản có cấu trúc như sau:

```dockerfile
# Syntax declaration (tùy chọn, dùng cho BuildKit)
# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Base image
# ============================================
FROM node:18-alpine

# Metadata
LABEL maintainer="dev@example.com"
LABEL version="1.0"

# Biến môi trường
ENV NODE_ENV=production
ENV PORT=3000

# Thư mục làm việc
WORKDIR /app

# Copy dependency files trước (tận dụng cache)
COPY package.json package-lock.json ./

# Cài đặt dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Chạy với non-root user
USER node

# Lệnh khởi động
CMD ["node", "dist/main.js"]
```

### 4.3. Tất Cả Dockerfile Instructions (Chi Tiết)

Dưới đây là **tất cả các instructions** trong Dockerfile, được giải thích chi tiết:

#### **🔹 FROM - Base Image**

```dockerfile
# Cú pháp
FROM <image>[:<tag>] [AS <name>]

# Ví dụ
FROM node:18-alpine                    # Node.js 18 trên Alpine Linux
FROM python:3.11-slim                  # Python 3.11 slim variant
FROM ubuntu:22.04                      # Ubuntu 22.04
FROM scratch                           # Image trống (cho static binaries)
FROM node:18-alpine AS builder         # Named stage cho multi-stage build
```

**Quy tắc:**
- **BẮT BUỘC** phải là instruction đầu tiên (trừ ARG)
- Mỗi `FROM` tạo một **build stage** mới
- Nên dùng **specific tag** thay vì `latest` để đảm bảo reproducibility
- Ưu tiên **alpine** hoặc **slim** variants để giảm kích thước image

#### **🔹 WORKDIR - Thư mục làm việc**

```dockerfile
# Cú pháp
WORKDIR /path/to/directory

# Ví dụ
WORKDIR /app
WORKDIR /usr/src/app

# WORKDIR tạo thư mục nếu chưa tồn tại
WORKDIR /app/src    # Tạo cả /app và /app/src nếu chưa có
```

**Quy tắc:**
- Luôn dùng `WORKDIR` thay vì `RUN cd /path` (vì `cd` không persist giữa các layers)
- Dùng **đường dẫn tuyệt đối** (absolute path)
- Có thể dùng nhiều `WORKDIR` trong một Dockerfile

#### **🔹 COPY vs ADD - Sao chép files**

```dockerfile
# COPY - Sao chép files/directories từ build context
COPY package.json ./                   # Copy 1 file
COPY package.json package-lock.json ./ # Copy nhiều files
COPY . .                               # Copy toàn bộ build context
COPY --chown=node:node . .             # Copy và đổi owner
COPY --from=builder /app/dist ./dist   # Copy từ stage khác (multi-stage)

# ADD - Giống COPY nhưng có thêm tính năng
ADD https://example.com/file.tar.gz /app/   # Download từ URL
ADD archive.tar.gz /app/                     # Tự động extract tar archives
```

**Khi nào dùng COPY vs ADD?**

| Tính năng | COPY | ADD |
|-----------|------|-----|
| Copy files từ build context | ✅ | ✅ |
| Copy từ stage khác (`--from`) | ✅ | ❌ |
| Download từ URL | ❌ | ✅ |
| Tự động extract tar archives | ❌ | ✅ |
| **Khuyến nghị** | **✅ Ưu tiên dùng** | ⚠️ Chỉ khi cần extract |

> 💡 **Best Practice**: **Luôn dùng COPY** trừ khi bạn cần tính năng auto-extract của ADD. Điều này giúp Dockerfile rõ ràng và dễ hiểu hơn.

#### **🔹 RUN - Thực thi lệnh khi build**

```dockerfile
# Shell form (chạy qua /bin/sh -c)
RUN apt-get update && apt-get install -y curl
RUN npm ci --only=production

# Exec form (chạy trực tiếp, không qua shell)
RUN ["npm", "ci", "--only=production"]

# Multi-line RUN (gộp nhiều lệnh để giảm layers)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
      wget \
      git && \
    rm -rf /var/lib/apt/lists/*    # Dọn dẹp cache
```

**Quy tắc quan trọng:**
- **Gộp nhiều lệnh** vào một `RUN` bằng `&&` để giảm số layers
- **Dọn dẹp cache** trong cùng `RUN` instruction (nếu tách ra sẽ không giảm size vì layer trước đã lưu)
- Dùng `--no-install-recommends` khi cài packages để giảm kích thước
- Mỗi `RUN` tạo một **layer mới** trong image

#### **🔹 ENV - Biến môi trường**

```dockerfile
# Cú pháp
ENV <key>=<value>
ENV <key1>=<value1> <key2>=<value2>

# Ví dụ
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=postgresql://localhost:5432/mydb

# Sử dụng biến ENV trong Dockerfile
ENV APP_HOME=/app
WORKDIR ${APP_HOME}
```

**Đặc điểm:**
- Biến ENV **tồn tại** cả trong quá trình build VÀ khi container chạy
- Có thể override khi chạy container: `docker run -e PORT=4000 myapp`
- Mỗi `ENV` tạo một layer mới → gộp nhiều biến vào một `ENV` nếu có thể

#### **🔹 ARG - Biến build-time**

```dockerfile
# Cú pháp
ARG <name>[=<default_value>]

# Ví dụ
ARG NODE_VERSION=18
FROM node:${NODE_VERSION}-alpine

ARG BUILD_DATE
ARG GIT_COMMIT
LABEL build_date=${BUILD_DATE}
LABEL git_commit=${GIT_COMMIT}
```

**ENV vs ARG:**

| Khía cạnh | ENV | ARG |
|-----------|-----|-----|
| **Tồn tại khi build** | ✅ | ✅ |
| **Tồn tại khi container chạy** | ✅ | ❌ |
| **Override khi build** | ❌ | ✅ (`--build-arg`) |
| **Override khi run** | ✅ (`-e`) | ❌ |
| **Dùng trước FROM** | ❌ | ✅ |

```bash
# Truyền ARG khi build
docker build --build-arg NODE_VERSION=20 --build-arg BUILD_DATE=$(date -u +%Y-%m-%d) -t myapp .
```

#### **🔹 EXPOSE - Khai báo port**

```dockerfile
# Cú pháp
EXPOSE <port>[/<protocol>]

# Ví dụ
EXPOSE 3000              # TCP (mặc định)
EXPOSE 3000/tcp          # Explicit TCP
EXPOSE 3000/udp          # UDP
EXPOSE 3000 3001 8080    # Nhiều ports
```

**⚠️ Lưu ý quan trọng:**
- `EXPOSE` chỉ là **documentation** (khai báo), KHÔNG thực sự mở port
- Để thực sự map port, phải dùng `-p` khi `docker run`:
  ```bash
  docker run -p 8080:3000 myapp    # Map host:8080 → container:3000
  docker run -P myapp              # Map tất cả EXPOSE ports sang random ports
  ```

#### **🔹 USER - Chạy với user cụ thể**

```dockerfile
# Tạo non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Chuyển sang non-root user
USER appuser

# Hoặc dùng user có sẵn (ví dụ: node image có sẵn user "node")
USER node
```

**Tại sao cần non-root user?**
- **Bảo mật**: Nếu container bị tấn công, attacker không có quyền root
- **Best Practice**: Không bao giờ chạy production container với root
- **Compliance**: Nhiều security policies yêu cầu non-root containers

#### **🔹 HEALTHCHECK - Kiểm tra sức khỏe container**

```dockerfile
# Cú pháp
HEALTHCHECK [OPTIONS] CMD <command>
HEALTHCHECK NONE    # Tắt healthcheck

# Ví dụ
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Dùng wget cho Alpine (không có curl mặc định)
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
```

**Các options:**

| Option | Mặc định | Mô tả |
|--------|----------|--------|
| `--interval` | 30s | Khoảng thời gian giữa các lần check |
| `--timeout` | 30s | Thời gian tối đa cho mỗi lần check |
| `--start-period` | 0s | Thời gian chờ trước khi bắt đầu check |
| `--retries` | 3 | Số lần thất bại liên tiếp trước khi đánh dấu unhealthy |

#### **🔹 LABEL - Metadata cho image**

```dockerfile
LABEL maintainer="dev@example.com"
LABEL version="1.0"
LABEL description="NestJS Ecommerce API"
LABEL org.opencontainers.image.source="https://github.com/org/repo"

# Gộp nhiều labels
LABEL maintainer="dev@example.com" \
      version="1.0" \
      description="NestJS Ecommerce API"
```

#### **🔹 VOLUME - Khai báo mount point**

```dockerfile
# Cú pháp
VOLUME ["/data"]
VOLUME /data /logs

# Ví dụ
VOLUME ["/app/uploads", "/app/logs"]
```

**Lưu ý:** Giống `EXPOSE`, `VOLUME` trong Dockerfile chỉ là **documentation**. Để thực sự mount volume, dùng `-v` khi `docker run`:
```bash
docker run -v /host/data:/app/uploads myapp
docker run -v myvolume:/app/uploads myapp    # Named volume
```

### 4.4. Multi-Stage Build (Build nhiều giai đoạn)

Đây là kỹ thuật **cực kỳ quan trọng** trong production. Multi-stage build cho phép bạn sử dụng nhiều `FROM` trong một Dockerfile để tạo ra image nhỏ gọn hơn.

**Vấn đề khi KHÔNG dùng multi-stage:**

```
Image chứa TẤT CẢ:
├── Source code (không cần trong production)
├── Dev dependencies (typescript, eslint, jest...)
├── Build tools (gcc, make, python...)
├── Build artifacts (dist/)
└── Production dependencies

→ Image size: 800MB - 1.5GB 😱
```

**Giải pháp với multi-stage build:**

```dockerfile
# ============================================
# Stage 1: BUILD (Giai đoạn build)
# ============================================
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json ./

# Cài TẤT CẢ dependencies (bao gồm devDependencies)
RUN npm ci

# Copy source code
COPY . .

# Build ứng dụng
RUN npm run build

# ============================================
# Stage 2: PRODUCTION (Giai đoạn production)
# ============================================
FROM node:18-alpine AS production

WORKDIR /app

# Chỉ copy package files
COPY package.json package-lock.json ./

# Chỉ cài production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy CHỈ build artifacts từ stage builder
COPY --from=builder /app/dist ./dist

# Non-root user
USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

**Kết quả:**

```
Stage 1 (builder):     ~800MB  → Bị loại bỏ sau khi build xong
Stage 2 (production):  ~150MB  → Image cuối cùng ✅

Giảm 80%+ kích thước image!
```

```
┌─────────────────────────────────────────────────────────────┐
│                    MULTI-STAGE BUILD                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Stage 1: builder                Stage 2: production         │
│  ┌──────────────────┐           ┌──────────────────┐        │
│  │ node:18-alpine   │           │ node:18-alpine   │        │
│  │ ALL dependencies │           │ prod deps ONLY   │        │
│  │ Source code      │  COPY     │ dist/ artifacts   │        │
│  │ Build tools      │ ──────►  │                   │        │
│  │ dist/ output     │ (chỉ     │ → Image nhỏ gọn  │        │
│  │                  │  dist/)   │   ~150MB          │        │
│  │ ~800MB           │           │                   │        │
│  └──────────────────┘           └──────────────────┘        │
│  ❌ Bị loại bỏ                  ✅ Image cuối cùng           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.5. File .dockerignore

Giống `.gitignore`, file `.dockerignore` chỉ định các files/directories **không được gửi** vào build context:

```dockerignore
# .dockerignore
node_modules
npm-debug.log*
dist
.git
.gitignore
.env
.env.*
*.md
!README.md
Dockerfile*
docker-compose*
.dockerignore
.vscode
.idea
coverage
test
__tests__
*.spec.ts
*.test.ts
```

**Tại sao .dockerignore quan trọng?**

1. **Giảm build context size** → Build nhanh hơn
2. **Tránh gửi files nhạy cảm** (.env, secrets) vào image
3. **Tránh ghi đè** node_modules đã cài trong container
4. **Giảm cache invalidation** → Ít rebuild layers hơn

### 4.6. Dockerfile Best Practices Checklist

| # | Best Practice | Lý do |
|---|--------------|-------|
| 1 | Dùng **specific base image tag** (`node:18-alpine`, không dùng `node:latest`) | Đảm bảo reproducible builds |
| 2 | Dùng **multi-stage build** | Giảm image size 50-80% |
| 3 | Dùng **`.dockerignore`** | Giảm build context, bảo mật |
| 4 | **COPY dependencies trước, code sau** | Tận dụng Docker layer cache |
| 5 | **Gộp RUN commands** bằng `&&` | Giảm số layers, giảm image size |
| 6 | **Dọn dẹp cache** trong cùng RUN | Giảm layer size |
| 7 | Dùng **non-root USER** | Bảo mật |
| 8 | Thêm **HEALTHCHECK** | Monitoring, auto-restart |
| 9 | Dùng **COPY** thay vì ADD | Rõ ràng, dễ hiểu |
| 10 | Thêm **LABEL** metadata | Quản lý images dễ hơn |

> 💡 **Ghi nhớ cho phỏng vấn**: Để tạo Dockerfile, bạn cần: (1) Chọn base image phù hợp với `FROM`, (2) Thiết lập working directory với `WORKDIR`, (3) Copy dependencies và cài đặt với `COPY` + `RUN`, (4) Copy source code, (5) Khai báo `EXPOSE` port, (6) Định nghĩa lệnh khởi động với `CMD` hoặc `ENTRYPOINT`. Luôn áp dụng **multi-stage build** và **non-root user** cho production.

---

## Câu 5: Sự khác biệt giữa CMD và ENTRYPOINT? (What is the difference between CMD and ENTRYPOINT?)

### 5.1. Tổng Quan

Đây là một trong những câu hỏi **hay bị nhầm lẫn nhất** trong phỏng vấn Docker. Cả `CMD` và `ENTRYPOINT` đều định nghĩa **lệnh sẽ chạy khi container khởi động**, nhưng chúng có vai trò và hành vi khác nhau.

Theo **tài liệu chính thức của Docker**:

> - **CMD**: Cung cấp **defaults** (giá trị mặc định) cho container đang chạy. Có thể bị **override** (ghi đè) hoàn toàn khi `docker run`.
> - **ENTRYPOINT**: Cấu hình container để chạy như một **executable** (chương trình thực thi). Không dễ bị override.

**Cách nhớ đơn giản:**
- `ENTRYPOINT` = **"Chương trình chính"** (luôn chạy, khó thay đổi)
- `CMD` = **"Tham số mặc định"** (dễ dàng thay đổi khi `docker run`)

### 5.2. Hai Dạng Cú Pháp (Shell Form vs Exec Form)

Cả `CMD` và `ENTRYPOINT` đều hỗ trợ 2 dạng cú pháp:

#### **Exec Form (Khuyến nghị ✅)**

```dockerfile
CMD ["node", "dist/main.js"]
ENTRYPOINT ["node", "dist/main.js"]
```

- Chạy **trực tiếp** process (PID 1)
- **Nhận signals** đúng cách (SIGTERM, SIGINT)
- **Không** qua shell (`/bin/sh -c`)
- Cú pháp: JSON array với **double quotes**

#### **Shell Form (Không khuyến nghị ⚠️)**

```dockerfile
CMD node dist/main.js
ENTRYPOINT node dist/main.js
```

- Chạy qua `/bin/sh -c node dist/main.js`
- Shell process là PID 1, **không** forward signals đến app
- App **không nhận** SIGTERM → `docker stop` phải chờ timeout rồi SIGKILL
- Hỗ trợ shell features (variable expansion, pipes)

**Minh họa sự khác biệt PID:**

```
Exec Form:                          Shell Form:
┌─────────────────────┐            ┌─────────────────────┐
│ PID 1: node main.js │            │ PID 1: /bin/sh -c   │
│ ← Nhận SIGTERM ✅    │            │   └─ node main.js   │
│                     │            │      ← KHÔNG nhận    │
│                     │            │        SIGTERM ❌     │
└─────────────────────┘            └─────────────────────┘

docker stop → SIGTERM → App dừng   docker stop → SIGTERM → Shell nhận
              gracefully ✅                       nhưng KHÔNG forward
                                                  → Chờ 10s → SIGKILL ❌
```

> 💡 **Best Practice**: **LUÔN dùng Exec Form** cho cả CMD và ENTRYPOINT trong production.

### 5.3. CMD - Chi Tiết

`CMD` có **3 dạng** sử dụng:

```dockerfile
# Dạng 1: Exec form (khuyến nghị)
CMD ["node", "dist/main.js"]

# Dạng 2: Shell form
CMD node dist/main.js

# Dạng 3: Tham số cho ENTRYPOINT (dùng kết hợp với ENTRYPOINT)
ENTRYPOINT ["node"]
CMD ["dist/main.js"]
```

**Đặc điểm quan trọng của CMD:**

1. **Chỉ có 1 CMD** có hiệu lực trong Dockerfile (CMD cuối cùng thắng)
2. **Dễ dàng override** khi `docker run`:

```bash
# Dockerfile có: CMD ["node", "dist/main.js"]

# Chạy mặc định
docker run myapp
# → Thực thi: node dist/main.js

# Override CMD hoàn toàn
docker run myapp node dist/worker.js
# → Thực thi: node dist/worker.js (CMD bị ghi đè)

docker run myapp sh
# → Mở shell (CMD bị ghi đè hoàn toàn)
```

### 5.4. ENTRYPOINT - Chi Tiết

```dockerfile
# Exec form (khuyến nghị)
ENTRYPOINT ["node", "dist/main.js"]

# Shell form
ENTRYPOINT node dist/main.js
```

**Đặc điểm quan trọng của ENTRYPOINT:**

1. **Không dễ bị override** khi `docker run` (phải dùng `--entrypoint`)
2. Các arguments sau `docker run` được **THÊM VÀO** (append) sau ENTRYPOINT

```bash
# Dockerfile có: ENTRYPOINT ["node", "dist/main.js"]

# Chạy mặc định
docker run myapp
# → Thực thi: node dist/main.js

# Thêm arguments (KHÔNG override)
docker run myapp --port=4000
# → Thực thi: node dist/main.js --port=4000

# Muốn override ENTRYPOINT phải dùng --entrypoint
docker run --entrypoint sh myapp
# → Mở shell (override ENTRYPOINT)
```

### 5.5. Kết Hợp ENTRYPOINT + CMD (Pattern Phổ Biến Nhất)

Đây là **pattern được khuyến nghị** trong production: dùng `ENTRYPOINT` cho chương trình chính và `CMD` cho tham số mặc định.

```dockerfile
# ENTRYPOINT = chương trình chính (cố định)
# CMD = tham số mặc định (có thể thay đổi)
ENTRYPOINT ["node"]
CMD ["dist/main.js"]
```

**Cách hoạt động:**

```bash
# Chạy mặc định → ENTRYPOINT + CMD
docker run myapp
# → Thực thi: node dist/main.js

# Override CMD (giữ nguyên ENTRYPOINT)
docker run myapp dist/worker.js
# → Thực thi: node dist/worker.js

docker run myapp --version
# → Thực thi: node --version

docker run myapp dist/seed.js
# → Thực thi: node dist/seed.js
```

**Ví dụ thực tế với entrypoint script:**

```dockerfile
# Dockerfile
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
```

```bash
#!/bin/sh
# docker-entrypoint.sh

echo "🚀 Starting application..."

# Chạy database migrations nếu cần
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "📦 Running database migrations..."
  npx prisma migrate deploy
fi

# Chạy lệnh được truyền vào (CMD hoặc override)
exec "$@"
```

```bash
# Chạy app bình thường
docker run myapp
# → docker-entrypoint.sh → node dist/main.js

# Chạy với migrations
docker run -e RUN_MIGRATIONS=true myapp
# → docker-entrypoint.sh → prisma migrate deploy → node dist/main.js

# Override để chạy worker
docker run myapp node dist/worker.js
# → docker-entrypoint.sh → node dist/worker.js
```

### 5.6. Bảng So Sánh Tổng Hợp

| Khía cạnh | CMD | ENTRYPOINT |
|-----------|-----|------------|
| **Vai trò** | Tham số/lệnh mặc định | Chương trình chính |
| **Override khi `docker run`** | ✅ Dễ dàng (thêm args sau image name) | ❌ Phải dùng `--entrypoint` |
| **Số lượng trong Dockerfile** | Chỉ 1 (cuối cùng có hiệu lực) | Chỉ 1 (cuối cùng có hiệu lực) |
| **Kết hợp với nhau** | Trở thành tham số cho ENTRYPOINT | Nhận CMD làm tham số mặc định |
| **Khi nào dùng** | Lệnh mặc định có thể thay đổi | Container luôn chạy cùng 1 chương trình |
| **Ví dụ tương tự** | Arguments cho function | Function name |

### 5.7. Ma Trận Kết Hợp CMD + ENTRYPOINT

Bảng dưới đây cho thấy **chính xác** lệnh nào sẽ được thực thi với mỗi tổ hợp:

| | **Không có ENTRYPOINT** | **ENTRYPOINT exec_entry p1_entry** | **ENTRYPOINT ["exec_entry", "p1_entry"]** |
|---|---|---|---|
| **Không có CMD** | ❌ Lỗi | `/bin/sh -c exec_entry p1_entry` | `exec_entry p1_entry` |
| **CMD ["exec_cmd", "p1_cmd"]** | `exec_cmd p1_cmd` | `/bin/sh -c exec_entry p1_entry` | `exec_entry p1_entry exec_cmd p1_cmd` |
| **CMD exec_cmd p1_cmd** | `/bin/sh -c exec_cmd p1_cmd` | `/bin/sh -c exec_entry p1_entry` | `exec_entry p1_entry /bin/sh -c exec_cmd p1_cmd` |

> ⚠️ **Lưu ý quan trọng**: Khi ENTRYPOINT dùng **shell form**, CMD sẽ bị **BỎ QUA hoàn toàn**! Đây là lý do phải luôn dùng **exec form** cho ENTRYPOINT.

### 5.8. Ví Dụ Thực Tế Trong Các Image Phổ Biến

```dockerfile
# ── NGINX ──
# Dùng ENTRYPOINT + CMD
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
# → Override: docker run nginx nginx-debug -g 'daemon off;'

# ── PostgreSQL ──
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["postgres"]
# → Override: docker run postgres postgres -c shared_buffers=256MB

# ── Redis ──
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["redis-server"]
# → Override: docker run redis redis-server --maxmemory 256mb

# ── Node.js App (Best Practice) ──
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
# → Override: docker run myapp node dist/worker.js
```

> 💡 **Ghi nhớ cho phỏng vấn**: `CMD` cung cấp **lệnh/tham số mặc định** có thể dễ dàng override. `ENTRYPOINT` định nghĩa **chương trình chính** khó bị override. Kết hợp cả hai: `ENTRYPOINT` cho executable cố định, `CMD` cho tham số mặc định linh hoạt. **LUÔN dùng exec form** (JSON array) để đảm bảo signal handling đúng cách.

---

## 📝 TỔNG KẾT - Cheat Sheet Cho Phỏng Vấn

### Bảng Tóm Tắt 5 Câu Hỏi

| # | Câu hỏi | Câu trả lời ngắn gọn (30 giây) |
|---|---------|-------------------------------|
| 1 | **Docker là gì?** | Docker là nền tảng containerization cho phép đóng gói ứng dụng cùng dependencies vào container, chạy nhất quán trên mọi môi trường. Dùng kiến trúc client-server với Docker Daemon, CLI, và Registry. |
| 2 | **Docker Container là gì?** | Container là instance chạy được của image, là tiến trình cô lập trên Host OS (không phải VM). Được cô lập bằng Linux Namespaces và giới hạn tài nguyên bằng Cgroups. |
| 3 | **Mục đích Docker Image?** | Image là template read-only chứa instructions để tạo container. Sử dụng layered architecture với Union File System, hỗ trợ caching và Copy-on-Write để tối ưu. |
| 4 | **Cách tạo Dockerfile?** | Tạo file tên `Dockerfile` với các instructions: FROM (base image), WORKDIR, COPY, RUN, EXPOSE, CMD/ENTRYPOINT. Best practices: multi-stage build, non-root user, .dockerignore. |
| 5 | **CMD vs ENTRYPOINT?** | CMD = tham số mặc định (dễ override). ENTRYPOINT = chương trình chính (khó override). Kết hợp: ENTRYPOINT cho executable, CMD cho default args. Luôn dùng exec form. |

### Các Khái Niệm Cốt Lõi Cần Nhớ

```
🐳 DOCKER CORE CONCEPTS

1. Container ≠ VM
   Container = Tiến trình cô lập trên cùng kernel
   VM = Hệ điều hành riêng biệt trên hypervisor

2. Image = Layers
   Mỗi instruction = 1 layer
   Layers được cache và chia sẻ
   Union File System + Copy-on-Write

3. Dockerfile Best Practices
   ✅ Multi-stage build
   ✅ Specific base image tags
   ✅ COPY deps trước, code sau (cache)
   ✅ Non-root USER
   ✅ HEALTHCHECK
   ✅ .dockerignore

4. CMD vs ENTRYPOINT
   CMD = "Tham số mặc định" (override dễ)
   ENTRYPOINT = "Chương trình chính" (override khó)
   Kết hợp = Pattern tốt nhất
   LUÔN dùng exec form ["..."]

5. Cơ chế cô lập
   Namespaces = Cô lập (PID, NET, MNT, UTS, IPC, USER)
   Cgroups = Giới hạn tài nguyên (CPU, RAM, I/O)
```

---

## 📚 Tài Liệu Tham Khảo

| Nguồn | Link |
|-------|------|
| **Docker Official Docs** | https://docs.docker.com/ |
| **Dockerfile Reference** | https://docs.docker.com/reference/dockerfile/ |
| **Docker Best Practices** | https://docs.docker.com/build/building/best-practices/ |
| **Docker Hub** | https://hub.docker.com/ |
| **OCI (Open Container Initiative)** | https://opencontainers.org/ |
| **Docker Blog** | https://www.docker.com/blog/ |
| **Awesome Docker (GitHub)** | https://github.com/veggiemonk/awesome-docker |

---

> 📅 **Ngày tạo**: 2025-02-08
>
> 📖 **Ghi chú**: Tài liệu này được biên soạn dựa trên kiến thức từ tài liệu chính thức của Docker (docs.docker.com), cộng đồng chuyên gia Docker, và các best practices được công nhận rộng rãi trong ngành công nghiệp phần mềm.