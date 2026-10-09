/**
 * ============================================================================
 * KHO HÀNG CỤC BỘ (LOCALSTORAGE ENGINE)
 * Mục đích: Quản lý hàng hóa tồn kho lưu trữ 100% tại HTML5 LocalStorage
 * Phục vụ bài tập deploy lên hosting & trải nghiệm lưu trữ cục bộ LocalStorage
 * ============================================================================
 */

class LocalWarehouseApp {
  constructor() {
    this.STORAGE_KEY = 'danh_sach_hang_hoa';
    this.THEME_KEY = 'app_theme_mode';
    
    // Dữ liệu hàng hóa trong kho
    this.items = [];

    // Trạng thái tìm kiếm & phân trang
    this.state = {
      search: '',
      status: 'all',
      unit: '',
      page: 1,
      pageSize: 15
    };

    this.init();
  }

  init() {
    this.initAuth();
    this.initTheme();
    this.loadFromStorage();
    this.bindEvents();
    this.renderAll();
  }

  // ==========================================================================
  // XÁC THỰC MẬT MÃ TRUY CẬP (PASSWORD GATEWAY: 12345)
  // ==========================================================================
  initAuth() {
    const lockScreen = document.getElementById('lockScreen');
    const lockForm = document.getElementById('lockForm');
    const pwdInput = document.getElementById('passwordInput');
    const lockError = document.getElementById('lockErrorMsg');
    const lockCard = document.getElementById('lockCard');
    const btnToggle = document.getElementById('btnTogglePwd');
    const btnLock = document.getElementById('btnLockScreen');

    // Mặc định luôn hiện khóa khi mới vào hoặc theo session
    const isUnlocked = sessionStorage.getItem('wms_auth_unlocked') === 'true';
    if (isUnlocked && lockScreen) {
      lockScreen.classList.add('unlocked');
    } else if (pwdInput) {
      setTimeout(() => pwdInput.focus(), 150);
    }

    // Nút ẩn/hiện mật khẩu
    btnToggle?.addEventListener('click', () => {
      if (!pwdInput) return;
      pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
    });

    // Xử lý kiểm tra mật khẩu 12345
    lockForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const entered = (pwdInput?.value || '').trim();
      if (entered === '12345') {
        lockError?.classList.remove('show');
        lockScreen?.classList.add('unlocked');
        sessionStorage.setItem('wms_auth_unlocked', 'true');
        this.showToast('🔓 Mở khóa thành công! Chào mừng bạn.');
      } else {
        lockError?.classList.add('show');
        lockCard?.classList.add('shake');
        setTimeout(() => lockCard?.classList.remove('shake'), 400);
        if (pwdInput) pwdInput.select();
      }
    });

    // Nút Khóa trên thanh Header
    btnLock?.addEventListener('click', () => {
      sessionStorage.removeItem('wms_auth_unlocked');
      lockScreen?.classList.remove('unlocked');
      if (pwdInput) {
        pwdInput.value = '';
        setTimeout(() => pwdInput.focus(), 150);
      }
      lockError?.classList.remove('show');
      this.showToast('🔒 Đã khóa màn hình hệ thống.');
    });
  }

  // ==========================================================================
  // GIAO DIỆN SÁNG / TỐI (THEME)
  // ==========================================================================
  initTheme() {
    const savedTheme = localStorage.getItem(this.THEME_KEY) || 'light';
    this.setTheme(savedTheme);

    document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      this.setTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.THEME_KEY, theme);
    const label = document.getElementById('themeLabel');
    if (label) {
      label.textContent = theme === 'dark' ? '☀️ Chế độ sáng' : '🌙 Chế độ tối';
    }
  }

  // ==========================================================================
  // XỬ LÝ LOCALSTORAGE
  // ==========================================================================
  loadFromStorage() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.items = parsed;
          return;
        }
      }
    } catch (e) {
      console.error('Lỗi khi đọc LocalStorage:', e);
    }
    // Nếu chưa có dữ liệu trong LocalStorage của máy này -> để trống
    this.items = [];
  }

  saveToStorage(notify = false, msg = 'Đã cập nhật LocalStorage') {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.items));
      if (notify) this.showToast(msg);
    } catch (e) {
      console.error('Lỗi lưu LocalStorage:', e);
      alert('Không thể lưu vào LocalStorage (có thể đã đầy bộ nhớ).');
    }
  }

  // Tính lại trạng thái theo số lượng tồn
  calcStatus(qty) {
    const num = Number(qty || 0);
    if (num > 10) return 'high';
    if (num >= 6) return 'normal';
    if (num >= 1) return 'low';
    return 'out';
  }

  // ==========================================================================
  // BIND SỰ KIỆN TƯƠNG TÁC
  // ==========================================================================
  bindEvents() {
    // Tìm kiếm
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
      this.state.search = e.target.value.trim();
      this.state.page = 1;
      this.renderTable();
    });

    // Lọc trạng thái (Tất cả, Còn nhiều, Gần hết, Hết hàng)
    document.querySelectorAll('#statusFilterPills .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#statusFilterPills .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.status = btn.getAttribute('data-status');
        this.state.page = 1;
        this.renderTable();
      });
    });

    // Lọc theo ĐVT
    document.getElementById('unitSelect')?.addEventListener('change', (e) => {
      this.state.unit = e.target.value;
      this.state.page = 1;
      this.renderTable();
    });

    // Số dòng trên trang
    document.getElementById('pageSizeSelect')?.addEventListener('change', (e) => {
      this.state.pageSize = parseInt(e.target.value, 10);
      this.state.page = 1;
      this.renderTable();
    });

    // Mở Modal Thêm mới
    document.getElementById('btnOpenAddModal')?.addEventListener('click', () => {
      this.openProductModal();
    });

    // Submit form Thêm / Sửa
    document.getElementById('productForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });

    // CÔNG CỤ DEMO DÀNH CHO GIẢNG VIÊN:
    // 1. Nạp 320 món từ Excel vào máy này
    document.getElementById('btnSeedExcel')?.addEventListener('click', () => {
      this.seedFromExcel();
    });

    // 2. Xóa sạch LocalStorage (mô phỏng máy học sinh)
    document.getElementById('btnClearStorage')?.addEventListener('click', () => {
      if (confirm('Mô phỏng máy học viên: Thao tác này sẽ xóa sạch LocalStorage trên trình duyệt này để bạn chứng minh cho học viên thấy trên trình duyệt khác sẽ không có dữ liệu này. Bạn có chắc không?')) {
        this.items = [];
        this.saveToStorage(true, 'Đã xóa trắng LocalStorage (0 sản phẩm)');
        this.renderAll();
      }
    });

    // 3. Xem mã JSON trong LocalStorage
    document.getElementById('btnViewJson')?.addEventListener('click', () => {
      const viewer = document.getElementById('jsonViewer');
      const raw = localStorage.getItem(this.STORAGE_KEY) || '[]';
      try {
        viewer.value = JSON.stringify(JSON.parse(raw), null, 2);
      } catch (e) {
        viewer.value = raw;
      }
      document.getElementById('jsonModal').classList.add('active');
    });
  }

  // ==========================================================================
  // NẠP DỮ LIỆU TỪ EXCEL VÀO LOCALSTORAGE CỦA MÁY NÀY
  // ==========================================================================
  seedFromExcel() {
    if (!window.EXCEL_SEED_DATA || !Array.isArray(window.EXCEL_SEED_DATA)) {
      alert('Không tìm thấy dữ liệu mẫu Excel.');
      return;
    }
    this.items = JSON.parse(JSON.stringify(window.EXCEL_SEED_DATA));
    this.saveToStorage(true, 'Đã nạp thành công 320 mặt hàng từ Excel vào LocalStorage!');
    this.renderAll();
  }

  // ==========================================================================
  // RENDER DỮ LIỆU TOÀN TRANG
  // ==========================================================================
  renderAll() {
    this.renderKPIs();
    this.renderUnitSelect();
    this.renderTable();
  }

  renderKPIs() {
    const total = this.items.length;
    let high = 0, normal = 0, low = 0, out = 0;

    this.items.forEach(item => {
      const st = this.calcStatus(item.quantity);
      if (st === 'high') high++;
      else if (st === 'normal') normal++;
      else if (st === 'low') low++;
      else out++;
    });

    document.getElementById('statTotalSku').textContent = total.toLocaleString('vi-VN');
    document.getElementById('statHighStock').textContent = high.toLocaleString('vi-VN');
    document.getElementById('statLowStock').textContent = low.toLocaleString('vi-VN');
    document.getElementById('statOutStock').textContent = out.toLocaleString('vi-VN');

    document.getElementById('pillCountAll').textContent = total;
    document.getElementById('pillCountHigh').textContent = high;
    document.getElementById('pillCountNormal').textContent = normal;
    document.getElementById('pillCountLow').textContent = low;
    document.getElementById('pillCountOut').textContent = out;
  }

  renderUnitSelect() {
    const select = document.getElementById('unitSelect');
    if (!select) return;
    const cur = select.value;
    const units = [...new Set(this.items.map(i => i.unit).filter(Boolean))].sort();

    select.innerHTML = '<option value="">Tất cả ĐVT</option>';
    units.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      if (u === cur) opt.selected = true;
      select.appendChild(opt);
    });
  }

  renderTable() {
    const tbody = document.getElementById('productTbody');
    if (!tbody) return;

    const { search, status, unit, page, pageSize } = this.state;

    // Filter
    let filtered = this.items.filter(item => {
      if (search) {
        const q = search.toLowerCase();
        const mName = (item.name || '').toLowerCase().includes(q);
        const mId = (item.id || '').toLowerCase().includes(q);
        if (!mName && !mId) return false;
      }

      if (unit && item.unit !== unit) return false;

      if (status !== 'all') {
        const curStatus = this.calcStatus(item.quantity);
        if (curStatus !== status) return false;
      }

      return true;
    });

    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const currentPage = Math.min(page, totalPages);
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalCount);
    const paginated = filtered.slice(startIdx, endIdx);

    if (this.items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-box">
              <div class="empty-icon">📂</div>
              <div style="font-weight: 700; font-size: 16px;">LocalStorage Trên Máy Này Đang Trống (0 Mặt Hàng)</div>
              <div style="color: var(--text-muted); font-size: 13px; max-width: 500px;">
                Đây chính là trạng thái mà một người khác mở trang web trên máy của họ sẽ nhìn thấy! Để nạp dữ liệu demo từ Excel vào máy này, hãy bấm nút bên dưới:
              </div>
              <button class="btn btn-primary" onclick="app.seedFromExcel()" style="margin-top: 8px;">
                ⚡ Nạp 320 mặt hàng từ Excel vào máy này
              </button>
            </div>
          </td>
        </tr>
      `;
      document.getElementById('paginationInfo').textContent = 'Chưa có dữ liệu';
      document.getElementById('paginationControls').innerHTML = '';
      return;
    }

    if (paginated.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-box">
              <div class="empty-icon">🔍</div>
              <div style="font-weight: 700; font-size: 15px;">Không tìm thấy mặt hàng nào phù hợp</div>
              <div style="color: var(--text-muted); font-size: 13px;">Hãy thử xóa bộ lọc tìm kiếm hoặc chọn nhóm trạng thái khác.</div>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = paginated.map(item => {
        const qty = Number(item.quantity || 0);
        const st = this.calcStatus(qty);
        
        let badgeHtml = '';
        if (st === 'high') {
          badgeHtml = `<span class="badge badge-green"><span class="badge-dot"></span>Còn nhiều</span>`;
        } else if (st === 'normal') {
          badgeHtml = `<span class="badge badge-blue"><span class="badge-dot"></span>Bình thường</span>`;
        } else if (st === 'low') {
          badgeHtml = `<span class="badge badge-amber"><span class="badge-dot"></span>Gần hết (${qty})</span>`;
        } else {
          badgeHtml = `<span class="badge badge-red"><span class="badge-dot"></span>Đã hết hàng</span>`;
        }

        const colorNum = qty <= 0 ? 'var(--danger)' : (qty <= 5 ? 'var(--warning)' : 'var(--primary)');

        return `
          <tr>
            <td><code style="font-family: var(--font-mono); font-size: 11px; color: var(--text-muted);">${item.id}</code></td>
            <td class="sku-name">${this.escapeHtml(item.name)}</td>
            <td><span style="font-size: 12px; font-weight: 600; color: var(--text-muted);">${this.escapeHtml(item.unit || 'KIỆN')}</span></td>
            <td class="text-right">
              <span class="stock-num" style="color: ${colorNum};">${qty.toLocaleString('vi-VN')}</span>
            </td>
            <td class="text-center">${badgeHtml}</td>
            <td class="text-right">
              <div class="actions-group">
                <button class="btn-qty" title="Tăng 1 đơn vị" onclick="app.adjustQty('${item.id}', 1)">+</button>
                <button class="btn-qty minus" title="Giảm 1 đơn vị" onclick="app.adjustQty('${item.id}', -1)">-</button>
                <button class="btn-icon-action" title="Sửa tên hoặc số lượng" onclick="app.openProductModal('${item.id}')">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                </button>
                <button class="btn-icon-action del" title="Xóa mặt hàng này" onclick="app.deleteItem('${item.id}')">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path></svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Pagination info
    const infoEl = document.getElementById('paginationInfo');
    if (infoEl) {
      infoEl.textContent = `Hiển thị ${startIdx + 1} - ${endIdx} / tổng số ${totalCount} mặt hàng (Trang ${currentPage}/${totalPages})`;
    }

    this.renderPaginationButtons(currentPage, totalPages);
  }

  renderPaginationButtons(currentPage, totalPages) {
    const container = document.getElementById('paginationControls');
    if (!container) return;
    container.innerHTML = '';

    if (totalPages <= 1) return;

    // Prev
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-num';
    prevBtn.innerHTML = '&laquo;';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
      this.state.page = currentPage - 1;
      this.renderTable();
    };
    container.appendChild(prevBtn);

    // 5 pages around
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);

    for (let p = start; p <= end; p++) {
      const btn = document.createElement('button');
      btn.className = `page-num ${p === currentPage ? 'active' : ''}`;
      btn.textContent = p;
      const target = p;
      btn.onclick = () => {
        this.state.page = target;
        this.renderTable();
      };
      container.appendChild(btn);
    }

    // Next
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-num';
    nextBtn.innerHTML = '&raquo;';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => {
      this.state.page = currentPage + 1;
      this.renderTable();
    };
    container.appendChild(nextBtn);
  }

  // ==========================================================================
  // NHANH: TĂNG / GIẢM TỒN KHO (+1, -1)
  // ==========================================================================
  adjustQty(id, delta) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    const newQty = Math.max(0, Number(item.quantity || 0) + delta);
    item.quantity = newQty;
    item.status = this.calcStatus(newQty);

    this.saveToStorage(false);
    this.renderAll();
  }

  // ==========================================================================
  // THÊM / SỬA HÀNG HÓA
  // ==========================================================================
  openProductModal(id = null) {
    const modal = document.getElementById('productModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('productForm');
    form.reset();

    if (id) {
      const item = this.items.find(i => i.id === id);
      if (!item) return;
      title.textContent = 'Chỉnh Sửa Mặt Hàng';
      document.getElementById('editId').value = item.id;
      document.getElementById('formName').value = item.name;
      document.getElementById('formUnit').value = item.unit || 'KIỆN';
      document.getElementById('formQty').value = item.quantity;
    } else {
      title.textContent = 'Thêm Mặt Hàng Mới';
      document.getElementById('editId').value = '';
      document.getElementById('formUnit').value = 'KIỆN';
      document.getElementById('formQty').value = '10';
    }

    modal.classList.add('active');
  }

  handleFormSubmit() {
    const editId = document.getElementById('editId').value;
    const name = document.getElementById('formName').value.trim();
    const unit = document.getElementById('formUnit').value.trim() || 'KIỆN';
    const qty = Math.max(0, parseFloat(document.getElementById('formQty').value) || 0);

    if (!name) {
      alert('Vui lòng nhập tên hàng hóa.');
      return;
    }

    if (editId) {
      const idx = this.items.findIndex(i => i.id === editId);
      if (idx !== -1) {
        this.items[idx].name = name;
        this.items[idx].unit = unit;
        this.items[idx].quantity = qty;
        this.items[idx].status = this.calcStatus(qty);
        this.saveToStorage(true, `Đã sửa [${editId}] ${name}`);
      }
    } else {
      const newId = `SP-${String(this.items.length + 1).padStart(3, '0')}`;
      this.items.unshift({
        id: newId,
        name,
        unit,
        quantity: qty,
        status: this.calcStatus(qty)
      });
      this.saveToStorage(true, `Đã thêm mới [${newId}] ${name}`);
    }

    this.closeModal('productModal');
    this.renderAll();
  }

  deleteItem(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    if (confirm(`Xóa mặt hàng "${item.name}" khỏi LocalStorage?`)) {
      this.items = this.items.filter(i => i.id !== id);
      this.saveToStorage(true, `Đã xóa mặt hàng "${item.name}"`);
      this.renderAll();
    }
  }

  closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
  }

  // ==========================================================================
  // TOAST THÔNG BÁO
  // ==========================================================================
  showToast(message) {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toastMsg');
    if (!toast || !msgEl) return;

    msgEl.textContent = message;
    toast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Global instance
let app;
window.addEventListener('DOMContentLoaded', () => {
  app = new LocalWarehouseApp();
});
