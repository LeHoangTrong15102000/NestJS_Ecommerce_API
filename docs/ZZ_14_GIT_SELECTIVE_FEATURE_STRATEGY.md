# 🔄 Chiến Lược Git: Chọn Lọc Features từ Nhánh Dev

## 📋 Tình Huống Thực Tế

### 🎯 **Câu Hỏi Phỏng Vấn**

> "Khi đã phát triển 3 features (feature 1, feature 2, feature 3) và đã merge vào nhánh `dev`, nhưng khách hàng chỉ muốn lấy feature 1 và feature 2 thôi. Làm sao để tạo nhánh `release` chỉ chứa 2 features này để deploy lên production?"

### 🔍 **Phân Tích Vấn Đề**

Đây là tình huống rất phổ biến trong phát triển phần mềm thực tế khi:

- Features được phát triển song song
- Khách hàng thay đổi yêu cầu business
- Cần release một phần features trước deadline
- Một số features chưa đủ stable cho production

---

## 🛠️ Các Phương Pháp Giải Quyết

### **Phương Pháp 1: Cherry-pick (Khuyến nghị) 🍒**

#### **Mô tả:**

Chọn lọc các commits cụ thể từ nhánh `dev` và apply vào nhánh `release`.

#### **Các bước thực hiện:**

```bash
# 1. Tạo nhánh release từ main/master
git checkout main
git pull origin main
git checkout -b release/v1.0.0

# 2. Xác định các commits của feature 1 và feature 2
git log --oneline dev --grep="feat(feature1)"
git log --oneline dev --grep="feat(feature2)"

# Hoặc sử dụng git log với author/date range
git log --oneline --since="2024-01-01" --until="2024-01-15" dev

# 3. Cherry-pick các commits theo thứ tự chronological
git cherry-pick <commit-hash-feature1-1>
git cherry-pick <commit-hash-feature1-2>
git cherry-pick <commit-hash-feature2-1>
git cherry-pick <commit-hash-feature2-2>

# 4. Resolve conflicts nếu có
# Chỉnh sửa files có conflict
git add .
git cherry-pick --continue

# 5. Test và push release branch
npm test
git push origin release/v1.0.0
```

#### **Ví dụ cụ thể với dự án NestJS Ecommerce:**

```bash
# Giả sử có 3 features trong dev:
# - Feature 1: Authentication & 2FA
# - Feature 2: User Management với Roles
# - Feature 3: Payment Processing (CQRS)

# Khách hàng chỉ muốn Feature 1 & 2

# 1. Tạo release branch
git checkout main
git checkout -b release/auth-and-user-v1.0.0

# 2. Tìm commits của authentication
git log --oneline dev --grep="feat(auth)"
# Output:
# a1b2c3d feat(auth): implement JWT authentication
# e4f5g6h feat(auth): add 2FA with OTP
# i7j8k9l feat(auth): add Google OAuth integration

# 3. Tìm commits của user management
git log --oneline dev --grep="feat(user)"
# Output:
# m1n2o3p feat(user): implement user CRUD operations
# q4r5s6t feat(user): add role-based permissions
# u7v8w9x feat(user): add user profile management

# 4. Cherry-pick theo thứ tự
git cherry-pick a1b2c3d  # JWT auth
git cherry-pick e4f5g6h  # 2FA
git cherry-pick i7j8k9l  # Google OAuth
git cherry-pick m1n2o3p  # User CRUD
git cherry-pick q4r5s6t  # Role permissions
git cherry-pick u7v8w9x  # User profile

# 5. Verify features
npm test
npm run test:e2e
```

#### **Ưu điểm:**

- ✅ Precise control: Chọn chính xác commits cần thiết
- ✅ Clean history: History của release branch rõ ràng
- ✅ Rollback dễ dàng: Có thể undo từng commit
- ✅ Conflict resolution: Handle conflicts từng commit một

#### **Nhược điểm:**

- ❌ Time-consuming: Tốn thời gian khi có nhiều commits
- ❌ Manual process: Cần manual identify commits
- ❌ Conflict potential: Có thể gặp conflicts phức tạp

---

### **Phương Pháp 2: Interactive Rebase 🔄**

#### **Mô tả:**

Sử dụng `git rebase -i` để tái tổ chức lịch sử commits.

#### **Các bước thực hiện:**

```bash
# 1. Tạo nhánh working từ dev
git checkout dev
git checkout -b release/selective-features

# 2. Interactive rebase từ commit base
git rebase -i <base-commit-hash>

# 3. Trong editor, đánh dấu commits cần thiết:
# pick a1b2c3d feat(auth): implement JWT authentication
# pick e4f5g6h feat(auth): add 2FA with OTP
# drop f1g2h3i feat(payment): implement payment gateway  # DROP feature 3
# pick m1n2o3p feat(user): implement user CRUD operations
# drop n4o5p6q feat(payment): add CQRS pattern  # DROP feature 3
# pick q4r5s6t feat(user): add role-based permissions

# 4. Save và thực hiện rebase
# Git sẽ apply từng commit và bỏ qua các commits được đánh dấu "drop"

# 5. Force push (cẩn thận với force push!)
git push origin release/selective-features --force-with-lease
```

#### **Ưu điểm:**

- ✅ Visual control: Thấy được toàn bộ commits trong một view
- ✅ Flexible: Có thể edit, squash, reorder commits
- ✅ Clean result: Kết quả cuối rất clean

#### **Nhược điểm:**

- ❌ Destructive: Thay đổi history (nguy hiểm nếu branch được share)
- ❌ Complex conflicts: Conflicts có thể phức tạp và khó debug
- ❌ Risk: Force push có risk nếu không cẩn thận

---

### **Phương Pháp 3: Merge Strategy với Revert 📝**

#### **Mô tả:**

Merge toàn bộ từ dev sau đó revert feature không cần thiết.

#### **Các bước thực hiện:**

```bash
# 1. Tạo release branch và merge dev
git checkout main
git checkout -b release/v1.0.0
git merge dev

# 2. Identify merge commits của feature 3 (không mong muốn)
git log --oneline --merges
# Tìm commit: "Merge feature/payment-processing into dev"

# 3. Revert merge commit của feature 3
git revert -m 1 <merge-commit-hash-of-feature3>

# 4. Verify và test
npm test
git push origin release/v1.0.0
```

#### **Ví dụ cụ thể:**

```bash
# Trong dự án NestJS Ecommerce
git checkout main
git checkout -b release/no-payment-v1.0.0
git merge dev

# Tìm payment feature merge commit
git log --oneline --grep="payment"
# Output: x1y2z3a Merge feature/payment-processing into dev

# Revert payment feature
git revert -m 1 x1y2z3a

# Commit message sẽ là:
# "Revert payment processing feature for v1.0.0 release"

# Test để đảm bảo auth và user features vẫn hoạt động
npm run test:e2e -- --testNamePattern="auth|user"
```

#### **Ưu điểm:**

- ✅ Fast execution: Nhanh chóng thực hiện
- ✅ Safe: Không thay đổi history gốc
- ✅ Trackable: Có thể track được gì đã bị remove

#### **Nhược điểm:**

- ❌ Messy history: History có thêm revert commits
- ❌ Dependency issues: Có thể gặp vấn đề dependencies
- ❌ Incomplete removal: Có thể không remove hoàn toàn

---

### **Phương Pháp 4: Feature Branch Recreation 🏗️**

#### **Mô tả:**

Tạo lại release branch từ đầu chỉ với 2 features cần thiết.

#### **Các bước thực hiện:**

```bash
# 1. Tạo release branch từ main
git checkout main
git checkout -b release/auth-user-only

# 2. Merge từng feature branch riêng biệt (nếu còn tồn tại)
git merge feature/authentication
git merge feature/user-management

# 3. Hoặc cherry-pick từng feature hoàn chỉnh
# Identify feature boundaries
git log --oneline dev --grep="feat(auth)\|feat(user)"

# Group và cherry-pick theo feature
git cherry-pick <all-auth-commits>
git cherry-pick <all-user-commits>
```

#### **Ưu điểm:**

- ✅ Clean slate: Bắt đầu từ đầu, rất clean
- ✅ Precise: Chỉ chứa exactly những gì cần
- ✅ Clear intent: Rõ ràng mục đích của release

#### **Nhược điểm:**

- ❌ Manual work: Cần nhiều manual work
- ❌ Feature branch dependency: Cần có feature branches gốc
- ❌ Time consuming: Tốn thời gian

---

## 🎯 Best Practices & Recommendations

### **📋 Checklist cho Selective Feature Release:**

#### **1. Pre-work Preparation:**

- [ ] ✅ **Document feature boundaries**: Biết rõ commit nào thuộc feature nào
- [ ] ✅ **Use conventional commits**: `feat(scope): description` giúp filter dễ dàng
- [ ] ✅ **Feature flags**: Implement feature flags để enable/disable features
- [ ] ✅ **Modular architecture**: Thiết kế code modular để dễ tách biệt

#### **2. Git Strategy:**

- [ ] ✅ **Use meaningful commit messages**: Dễ identify commits
- [ ] ✅ **Atomic commits**: Mỗi commit là một unit hoàn chỉnh
- [ ] ✅ **Tag feature completion**: Tag khi feature hoàn thành
- [ ] ✅ **Branch naming convention**: `feature/auth-jwt`, `feature/user-crud`

#### **3. Testing Strategy:**

- [ ] ✅ **Feature-specific tests**: Tests riêng cho từng feature
- [ ] ✅ **Integration tests**: Test interaction giữa features
- [ ] ✅ **E2E test suites**: Test suites cho different feature combinations
- [ ] ✅ **Automated testing**: CI/CD pipeline test từng combination

#### **4. Documentation:**

- [ ] ✅ **Feature documentation**: Document rõ feature dependencies
- [ ] ✅ **Release notes**: Ghi rõ features included/excluded
- [ ] ✅ **Migration guides**: Nếu có breaking changes
- [ ] ✅ **Rollback procedures**: Plan cho rollback nếu cần

### **🏆 Recommendation cho dự án NestJS Ecommerce:**

Dựa trên phân tích source code của bạn, đây là recommendation:

#### **Phương pháp tốt nhất: Cherry-pick + Feature Flags**

```typescript
// 1. Implement feature flags trong dự án
// src/shared/services/feature-flag.service.ts
@Injectable()
export class FeatureFlagService {
  constructor(private configService: ConfigService) {}

  isEnabled(feature: string): boolean {
    return this.configService.get(`FEATURE_${feature.toUpperCase()}`) === 'true'
  }
}

// 2. Use trong controllers
@Controller('payment')
export class PaymentController {
  @Get()
  @UseGuards(FeatureGuard('PAYMENT'))
  async getPayments() {
    // Payment logic
  }
}

// 3. Environment-based feature control
// .env.production
FEATURE_AUTH=true
FEATURE_USER=true
FEATURE_PAYMENT=false  # Disable payment for v1.0.0

// .env.staging
FEATURE_AUTH=true
FEATURE_USER=true
FEATURE_PAYMENT=true   # Enable all features for testing
```

#### **Git workflow:**

```bash
# 1. Cherry-pick approach cho immediate release
git checkout main
git checkout -b release/v1.0.0-auth-user

# Cherry-pick auth commits
git cherry-pick <auth-commits>

# Cherry-pick user commits
git cherry-pick <user-commits>

# 2. Feature flag approach cho future flexibility
# Deploy với feature flags disabled
# Có thể enable payment feature sau này mà không cần redeploy
```

---

## 🔧 Advanced Techniques

### **1. Git Hooks cho Feature Control:**

```bash
# .git/hooks/pre-commit
#!/bin/bash
# Validate commits belong to allowed features

allowed_features=("auth" "user")
commit_msg=$(git log -1 --pretty=%B)

for feature in "${allowed_features[@]}"; do
  if [[ $commit_msg == *"feat($feature)"* ]]; then
    exit 0
  fi
done

echo "❌ Commit contains disallowed features"
exit 1
```

### **2. Automated Feature Detection:**

```bash
# Script to detect feature boundaries
#!/bin/bash
# detect-features.sh

echo "🔍 Detecting features in dev branch..."

# Detect authentication features
echo "📱 Authentication features:"
git log --oneline dev --grep="feat(auth)" --pretty=format:"  %h %s"

echo ""
echo "👤 User management features:"
git log --oneline dev --grep="feat(user)" --pretty=format:"  %h %s"

echo ""
echo "💳 Payment features:"
git log --oneline dev --grep="feat(payment)" --pretty=format:"  %h %s"

# Generate cherry-pick commands
echo ""
echo "🍒 Cherry-pick commands for auth + user:"
git log --oneline dev --grep="feat(auth)\|feat(user)" --pretty=format:"git cherry-pick %h"
```

### **3. Multi-release Strategy:**

```bash
# Tạo multiple release branches cho different feature combinations

# Release 1: Auth only
git checkout -b release/v1.0.0-auth-only main
git cherry-pick <auth-commits>

# Release 2: Auth + User
git checkout -b release/v1.1.0-auth-user main
git cherry-pick <auth-commits>
git cherry-pick <user-commits>

# Release 3: Full features
git checkout -b release/v2.0.0-full main
git merge dev
```

---

## 📊 Comparison Matrix

| **Phương pháp**        | **Độ khó** | **Thời gian** | **Risk** | **Clean History** | **Flexibility** | **Khuyến nghị** |
| ---------------------- | ---------- | ------------- | -------- | ----------------- | --------------- | --------------- |
| **Cherry-pick**        | Trung bình | Trung bình    | Thấp     | ✅ Cao            | ✅ Cao          | ⭐⭐⭐⭐⭐      |
| **Interactive Rebase** | Cao        | Cao           | Cao      | ✅ Cao            | ✅ Cao          | ⭐⭐⭐          |
| **Merge + Revert**     | Thấp       | Thấp          | Thấp     | ❌ Thấp           | ⭐ Trung bình   | ⭐⭐            |
| **Feature Recreation** | Trung bình | Cao           | Thấp     | ✅ Cao            | ⭐ Thấp         | ⭐⭐⭐          |
| **Feature Flags**      | Trung bình | Trung bình    | Thấp     | ✅ Cao            | ✅ Rất cao      | ⭐⭐⭐⭐⭐      |

---

## 🎯 Kết Luận

### **💡 Key Takeaways:**

1. **Cherry-pick là phương pháp tốt nhất** cho tình huống này vì:

   - Precise control over commits
   - Clean history
   - Low risk
   - Good traceability

2. **Feature flags là long-term solution** tốt nhất:

   - Runtime control over features
   - No code redeployment needed
   - Easy A/B testing
   - Gradual rollout capability

3. **Preparation is key:**

   - Conventional commit messages
   - Modular architecture
   - Feature-specific tests
   - Clear documentation

4. **Team communication quan trọng:**
   - Inform team về selective release
   - Document decisions và rationale
   - Plan cho future feature additions

### **🚀 Action Items cho dự án NestJS Ecommerce:**

1. **Immediate (Tuần này):**

   - [ ] Implement conventional commit messages
   - [ ] Create cherry-pick script for auth + user features
   - [ ] Test selective feature combination

2. **Short-term (Tháng này):**

   - [ ] Implement feature flag service
   - [ ] Add feature guards cho controllers
   - [ ] Setup environment-based feature control

3. **Long-term (Quý này):**
   - [ ] Implement comprehensive feature flag system
   - [ ] Setup A/B testing infrastructure
   - [ ] Create automated release pipeline

---

**💬 Lời khuyên cuối:**
Trong phỏng vấn, hãy nhấn mạnh rằng bạn hiểu được:

- **Business impact** của selective feature release
- **Technical tradeoffs** của mỗi approach
- **Risk mitigation** strategies
- **Long-term maintainability** considerations

Điều này thể hiện bạn không chỉ biết technical solution mà còn hiểu business context và có strategic thinking!
