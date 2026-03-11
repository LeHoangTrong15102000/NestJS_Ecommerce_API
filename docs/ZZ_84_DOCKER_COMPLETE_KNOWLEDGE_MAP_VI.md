# 🐳 DOCKER COMPLETE KNOWLEDGE MAP — TỔNG HỢP & BỔ SUNG KIẾN THỨC

> **File tổng hợp toàn bộ kiến thức Docker/CI-CD từ 5 tài liệu hiện có (ZZ_16, ZZ_75, ZZ_76, ZZ_77, ZZ_80), kèm bổ sung các chủ đề chưa được cover.**

---

## 📋 MỤC LỤC

### PHẦN A — TÓM GỌN NỘI DUNG ĐÃ CÓ
1. [Kiến Thức Nền Tảng Docker (từ ZZ_77)](#1-kiến-thức-nền-tảng-docker-từ-zz_77)
2. [Docker Workflow Thực Tế (từ ZZ_76)](#2-docker-workflow-thực-tế-từ-zz_76)
3. [Docker Database Setup (từ ZZ_16)](#3-docker-database-setup-từ-zz_16)
4. [Dockerfile Enterprise Deep Dive (từ ZZ_75)](#4-dockerfile-enterprise-deep-dive-từ-zz_75)
5. [CI/CD Enterprise Pipeline (từ ZZ_80)](#5-cicd-enterprise-pipeline-từ-zz_80)

### PHẦN B — NỘI DUNG MỚI BỔ SUNG
6. [Docker Networking Chuyên Sâu](#6-docker-networking-chuyên-sâu)
7. [Docker Volumes & Storage Chuyên Sâu](#7-docker-volumes--storage-chuyên-sâu)
8. [Docker Compose Nâng Cao](#8-docker-compose-nâng-cao)
9. [Docker BuildKit Nâng Cao](#9-docker-buildkit-nâng-cao)
10. [Container Debugging & Troubleshooting Thực Chiến](#10-container-debugging--troubleshooting-thực-chiến)
11. [Docker Trong Microservices Patterns](#11-docker-trong-microservices-patterns)
12. [Câu Hỏi Phỏng Vấn Docker Nâng Cao](#12-câu-hỏi-phỏng-vấn-docker-nâng-cao)

---

# PHẦN A — TÓM GỌN NỘI DUNG ĐÃ CÓ

---

## 1. Kiến Thức Nền Tảng Docker (từ ZZ_77)

> **File gốc:** `ZZ_77_DOCKER_INTERVIEW_QUESTIONS_EXPLAINED.md` (~1242 dòng)

### Tóm tắt 5 câu hỏi phỏng vấn cơ bản:

| # | Câu hỏi | Điểm cốt lõi |
|---|---------|---------------|
| 1 | **Docker là gì?** | Nền tảng containerization, kiến trúc client-server (Daemon + CLI + Registry). Giải quyết "Works on my machine". |
| 2 | **Container là gì?** | Runnable instance của image. Cô lập bằng **Namespaces** (PID, NET, MNT, UTS, IPC, USER) + giới hạn tài nguyên bằng **Cgroups**. Container ≠ VM. |
| 3 | **Docker Image?** | Template read-only, layered architecture + Union File System + Copy-on-Write. Layers được cache & share. |
| 4 | **Cách tạo Dockerfile?** | FROM → WORKDIR → COPY → RUN → EXPOSE → CMD/ENTRYPOINT. Best practices: multi-stage, non-root, .dockerignore. |
| 5 | **CMD vs ENTRYPOINT?** | CMD = tham số mặc định (dễ override). ENTRYPOINT = chương trình chính (khó override). Luôn dùng exec form `["..."]`. |

### Kiến trúc Docker:

```
Docker Client (CLI) ──REST API──► Docker Daemon (dockerd) ──► Docker Registry
     docker build                    Quản lý: Images,          Docker Hub, ECR,
     docker run                      Containers, Networks,      GCR, ACR...
     docker push                     Volumes
```

### Container vs VM — Bảng so sánh nhanh:

| Tiêu chí | Container | VM |
|-----------|-----------|-----|
| Kích thước | MB (10-200MB) | GB (1-10GB) |
| Khởi động | Giây | Phút |
| Cô lập | Process-level (namespaces) | Hardware-level (hypervisor) |
| Hiệu suất | Gần native | Overhead đáng kể |
| Bảo mật | Chia sẻ kernel | Kernel riêng |

---

## 2. Docker Workflow Thực Tế (từ ZZ_76)

> **File gốc:** `ZZ_76_DOCKER_WORKFLOW_EXPLAINED.md` (~709 dòng)

### Workflow tóm gọn:

```
📄 Dockerfile ──build──► 🖼️ Image ──run──► 📦 Container
                              │
                         push ↓ pull
                              │
                    🏪 Container Registry
                    (Docker Hub, ECR, GCR)
```

### Khi nào cần/không cần Dockerfile:

| Cần Dockerfile | Không cần Dockerfile |
|----------------|---------------------|
| Custom app (NestJS API) | Official images (postgres, redis) |
| Customize official image | Dùng trực tiếp `image:` trong compose |
| Multi-stage build | |

### Docker Compose — Vai trò:

| Dùng cho | Không dùng cho |
|----------|----------------|
| Development environment | Production thực sự |
| Testing environment | Large-scale orchestration |
| Local production simulation | Multi-server deployment |

### Production alternatives: Kubernetes, AWS ECS, Google Cloud Run, Azure Container Apps, Docker Swarm.

---

## 3. Docker Database Setup (từ ZZ_16)

> **File gốc:** `ZZ_16_DOCKER_DATABASE_SETUP.md` (~204 dòng)

### Vấn đề & giải pháp:

```
Development: DATABASE_URL = postgresql://...@localhost:5432/db
Docker:      DATABASE_URL = postgresql://...@postgres:5432/db
                                          ↑ service name thay vì localhost
```

**Giải pháp:** Docker Compose environment ghi đè `.env` file. Thứ tự ưu tiên:
1. `environment:` trong docker-compose.yml (cao nhất)
2. `.env` file
3. Host system env vars
4. Default values trong app

---

## 4. Dockerfile Enterprise Deep Dive (từ ZZ_75)

> **File gốc:** `ZZ_75_DOCKERFILE_ENTERPRISE_DEEP_DIVE_VI.md` (~2547 dòng)

### Tóm tắt nội dung chính:

**Tại sao doanh nghiệp quan tâm Dockerfile:**
- Consistency (giảm 90% bugs môi trường)
- Scalability (Netflix: 4000+ microservices/ngày)
- Speed (build 30 phút → 2-3 phút)
- Cost (image 1GB → 100MB)
- Security (scan tự động, immutable infra)

