import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, doc, getDocs, setDoc, addDoc, deleteDoc, updateDoc, enableIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
    // ---- Firebase Configuration ----
    const firebaseConfig = {

        apiKey: "AIzaSyAuyWwdf80JkZTWD2-Wjo54eS6FuKAZoO0",

        authDomain: "talab-90cd3.firebaseapp.com",

        projectId: "talab-90cd3",

        storageBucket: "talab-90cd3.firebasestorage.app",

        messagingSenderId: "358155203964",

        appId: "1:358155203964:web:596bba00fcfca3125c60f9"

    };



    const firebaseApp = initializeApp(firebaseConfig);
    const db = getFirestore(firebaseApp);

    // Enable Firestore offline persistence (caches data locally for instant load)
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('Firestore persistence: multiple tabs open, persistence disabled.');
        } else if (err.code === 'unimplemented') {
            console.warn('Firestore persistence: browser does not support it.');
        } else {
            console.warn('Firestore persistence error:', err);
        }
    });

    // ---- Loading State ----
    const loadingBar = document.getElementById('loading-bar');
    function setLoading(state) {
        if (loadingBar) {
            loadingBar.style.display = state ? 'block' : 'none';
        }
    }

    // ---- Navigation Logic ----
    const navItems = document.querySelectorAll('.nav-item');
    const screens = document.querySelectorAll('.screen');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');

            // Update active state on nav
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            // Update active screen
            screens.forEach(s => s.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
        });
    });

    // ---- App Logic ----
    const form = document.getElementById('tracker-form');
    const logDateInput = document.getElementById('log-date');
    const priceInput = document.getElementById('price');
    const alertBox = document.getElementById('carry-over-alert');
    const alertMessage = document.getElementById('carry-over-message');
    const closeAlertBtn = document.getElementById('close-alert');

    const monthlyRevenueEl = document.getElementById('monthly-revenue');
    const monthlyDeferredEl = document.getElementById('monthly-deferred');
    const historyListEl = document.getElementById('history-list');
    const currentMonthDisplay = document.getElementById('current-month-display');
    const historyMonthDisplay = document.getElementById('history-month-display');
    const noHistoryMsg = document.getElementById('no-history-msg');

    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');

    // Revenue Breakdown Elements
    const revenueCard = document.getElementById('revenue-card');
    const revenueBreakdown = document.getElementById('revenue-breakdown');
    const monthlyDeliveryEarningsEl = document.getElementById('monthly-delivery-earnings');
    const monthlyTipsEarningsEl = document.getElementById('monthly-tips-earnings');

    // Modal Elements
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-form');
    const cancelEditBtn = document.getElementById('cancel-edit');

    // Payments Elements
    const paymentForm = document.getElementById('payment-form');
    const payDateInput = document.getElementById('pay-date');
    const currentBalanceEl = document.getElementById('current-balance');
    const paymentListEl = document.getElementById('payment-list');

    const paymentMonthDisplay = document.getElementById('payment-month-display');
    const prevPaymentMonthBtn = document.getElementById('prev-payment-month');
    const nextPaymentMonthBtn = document.getElementById('next-payment-month');
    const noPaymentMsg = document.getElementById('no-payment-msg');

    // Default configuration (using 1000 for standard Iraqi Dinar pricing example)
    let defaultPrice = localStorage.getItem('talab_fixed_price') || "1000";
    priceInput.value = defaultPrice;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    logDateInput.value = todayStr;
    payDateInput.value = todayStr;

    // State for History View
    let viewingDate = new Date(today.getFullYear(), today.getMonth(), 1);
    let paymentViewingDate = new Date(today.getFullYear(), today.getMonth(), 1);

    // ---- In-Memory Cache ----
    let cachedLogs = null;
    let cachedPayments = null;
    let cachedTrackingOrders = null;
    let cachedAreas = null;

    // Format Currency: Iraqi Dinar, Thousands Separator, 0 Decimal Places
    function formatCurrency(amount) {
        return Math.round(amount).toLocaleString('en-US');
    }

    // Format Arabic Month Name
    function getArabicMonthYear(dateObj) {
        const options = { month: 'long', year: 'numeric' };
        return dateObj.toLocaleDateString('ar-EG', options);
    }

    currentMonthDisplay.innerText = "الشهر الحالي: " + getArabicMonthYear(today);

    // Database - Daily Logs (Firestore)
    async function getLogs() {
        try {
            if (cachedLogs) return cachedLogs;
            setLoading(true);
            const snapshot = await getDocs(collection(db, 'daily_logs'));
            cachedLogs = {};
            snapshot.forEach(d => {
                cachedLogs[d.id] = d.data();
            });
            return cachedLogs;
        } catch (error) {
            console.error('Error fetching logs:', error);
            alert('حدث خطأ أثناء تحميل البيانات. تحقق من اتصال الإنترنت وإعدادات Firebase.');
            return {};
        } finally {
            setLoading(false);
        }
    }

    async function saveLog(date, data) {
        try {
            setLoading(true);
            await setDoc(doc(db, 'daily_logs', date), data);
            localStorage.setItem('talab_fixed_price', data.price);
            cachedLogs = null;
        } catch (error) {
            console.error('Error saving log:', error);
            alert('حدث خطأ أثناء حفظ السجل. تحقق من اتصال الإنترنت.');
            throw error;
        } finally {
            setLoading(false);
        }
    }

    // Database - Payments (Firestore)
    async function getPayments() {
        try {
            if (cachedPayments) return cachedPayments;
            setLoading(true);
            const snapshot = await getDocs(collection(db, 'payments'));
            cachedPayments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            return cachedPayments;
        } catch (error) {
            console.error('Error fetching payments:', error);
            alert('حدث خطأ أثناء تحميل بيانات المدفوعات.');
            return [];
        } finally {
            setLoading(false);
        }
    }

    async function savePayment(payment) {
        try {
            setLoading(true);
            await addDoc(collection(db, 'payments'), payment);
            cachedPayments = null;
        } catch (error) {
            console.error('Error saving payment:', error);
            alert('حدث خطأ أثناء حفظ الحركة.');
            throw error;
        } finally {
            setLoading(false);
        }
    }

    async function updatePaymentDoc(id, data) {
        try {
            setLoading(true);
            await updateDoc(doc(db, 'payments', id), data);
            cachedPayments = null;
        } catch (error) {
            console.error('Error updating payment:', error);
            alert('حدث خطأ أثناء التحديث.');
            throw error;
        } finally {
            setLoading(false);
        }
    }

    async function deletePaymentDoc(id) {
        try {
            setLoading(true);
            await deleteDoc(doc(db, 'payments', id));
            cachedPayments = null;
        } catch (error) {
            console.error('Error deleting payment:', error);
            alert('حدث خطأ أثناء الحذف.');
            throw error;
        } finally {
            setLoading(false);
        }
    }

    // Database - Tracking Orders (Firestore)
    async function getTrackingOrders() {
        try {
            if (cachedTrackingOrders) return cachedTrackingOrders;
            setLoading(true);
            const snapshot = await getDocs(collection(db, 'tracking_orders'));
            cachedTrackingOrders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            return cachedTrackingOrders;
        } catch (error) {
            console.error('Error fetching tracking orders:', error);
            alert('حدث خطأ أثناء تحميل طلبات المتابعة.');
            return [];
        } finally {
            setLoading(false);
        }
    }

    async function saveTrackingOrder(order) {
        try {
            setLoading(true);
            await addDoc(collection(db, 'tracking_orders'), order);
            cachedTrackingOrders = null;
        } catch (error) {
            console.error('Error saving tracking order:', error);
            alert('حدث خطأ أثناء حفظ الطلب.');
            throw error;
        } finally {
            setLoading(false);
        }
    }

    async function updateTrackingOrder(id, data) {
        try {
            setLoading(true);
            await updateDoc(doc(db, 'tracking_orders', id), data);
            cachedTrackingOrders = null;
        } catch (error) {
            console.error('Error updating tracking order:', error);
            alert('حدث خطأ أثناء تحديث الطلب.');
            throw error;
        } finally {
            setLoading(false);
        }
    }

    async function deleteTrackingOrder(id) {
        try {
            setLoading(true);
            await deleteDoc(doc(db, 'tracking_orders', id));
            cachedTrackingOrders = null;
        } catch (error) {
            console.error('Error deleting tracking order:', error);
            alert('حدث خطأ أثناء حذف الطلب.');
            throw error;
        } finally {
            setLoading(false);
        }
    }

    // Database - Delivery Areas (Firestore)
    async function getDeliveryAreas() {
        try {
            if (cachedAreas) return cachedAreas;
            const snapshot = await getDocs(collection(db, 'delivery_areas'));
            cachedAreas = snapshot.docs.map(d => ({ id: d.id, name: d.data().name }));
            return cachedAreas;
        } catch (error) {
            console.error('Error fetching delivery areas:', error);
            return [];
        }
    }

    async function saveDeliveryArea(name) {
        try {
            setLoading(true);
            const docRef = await addDoc(collection(db, 'delivery_areas'), { name });
            cachedAreas = null;
            return docRef.id;
        } catch (error) {
            console.error('Error saving delivery area:', error);
            alert('حدث خطأ أثناء حفظ المنطقة.');
            throw error;
        } finally {
            setLoading(false);
        }
    }

    async function deleteDeliveryArea(id) {
        try {
            setLoading(true);
            await deleteDoc(doc(db, 'delivery_areas', id));
            cachedAreas = null;
        } catch (error) {
            console.error('Error deleting delivery area:', error);
            alert('حدث خطأ أثناء حذف المنطقة.');
            throw error;
        } finally {
            setLoading(false);
        }
    }

    // Carry-over Mechanism
    async function checkCarryOver() {
        const logs = await getLogs();
        const dates = Object.keys(logs).sort();

        if (dates.length > 0) {
            const lastDate = dates[dates.length - 1];
            if (lastDate !== logDateInput.value) {
                const lastLog = logs[lastDate];
                if (Number(lastLog.deferred) > 0) {
                    alertMessage.innerText = `تذكير: لديك ${lastLog.deferred} طلبات مؤجلة من ورديتك السابقة (${lastDate}).`;
                    alertBox.classList.remove('hidden');
                }
            }
        }
    }

    closeAlertBtn.addEventListener('click', () => {
        alertBox.classList.add('hidden');
    });

    // Dashboard Update (Current Month)
    async function updateMainDashboard() {
        const logs = await getLogs();
        const now = new Date();
        const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        let totalMonthlyRevenue = 0;
        let totalMonthlyDelivery = 0;
        let totalMonthlyTips = 0;
        let mostRecentDeferred = 0;

        const sortedDates = Object.keys(logs).sort();
        if (sortedDates.length > 0) {
            const lastDate = sortedDates[sortedDates.length - 1];
            mostRecentDeferred = Number(logs[lastDate].deferred) || 0;
        }

        Object.keys(logs).forEach(date => {
            const log = logs[date];
            if (date.startsWith(currentMonthPrefix)) {
                const deliveryEarnings = Number(log.delivered) * Number(log.price);
                const tipsEarnings = Number(log.tips);
                totalMonthlyDelivery += deliveryEarnings;
                totalMonthlyTips += tipsEarnings;
                totalMonthlyRevenue += (deliveryEarnings + tipsEarnings);
            }
        });

        monthlyRevenueEl.innerHTML = `${formatCurrency(totalMonthlyRevenue)} <span>د.ع</span>`;
        monthlyDeliveryEarningsEl.innerText = `${formatCurrency(totalMonthlyDelivery)} د.ع`;
        monthlyTipsEarningsEl.innerText = `${formatCurrency(totalMonthlyTips)} د.ع`;
        monthlyDeferredEl.innerText = mostRecentDeferred;
    }

    // Revenue Breakdown Toggle
    revenueCard.addEventListener('click', () => {
        revenueBreakdown.classList.toggle('hidden');
    });

    // History View Update (Selected Month)
    async function updateHistoryView() {
        const logs = await getLogs();
        const viewingMonthStr = String(viewingDate.getMonth() + 1).padStart(2, '0');
        const viewingPrefix = `${viewingDate.getFullYear()}-${viewingMonthStr}`;

        historyMonthDisplay.innerText = getArabicMonthYear(viewingDate);
        historyListEl.innerHTML = '';

        const sortedDates = Object.keys(logs).sort().reverse();
        let foundAny = false;
        let monthTotalRevenue = 0;

        sortedDates.forEach(date => {
            if (date.startsWith(viewingPrefix)) {
                foundAny = true;
                const log = logs[date];
                const dailyRevenue = (Number(log.delivered) * Number(log.price)) + Number(log.tips);
                monthTotalRevenue += dailyRevenue;

                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                historyItem.innerHTML = `
                    <div class="history-item-header">
                        <div class="history-item-date">${date}</div>
                        <div class="history-item-revenue">${formatCurrency(dailyRevenue)} د.ع</div>
                    </div>
                    <div class="history-item-details">
                        <div class="details-grid">
                            <span>الطلبات الكلي المستلمة:</span> <span>${log.received || 0}</span>
                            <span>الطلبات المسلمة:</span> <span>${log.delivered}</span>
                            <span>الإكراميات:</span> <span>${formatCurrency(Number(log.tips))} د.ع</span>
                            <span>سعر التوصيل:</span> <span>${formatCurrency(Number(log.price))} د.ع</span>
                            <span>الطلبات المؤجلة:</span> <span>${log.deferred}</span>
                            <span>الطلبات المرتجعة:</span> <span>${log.returned}</span>
                        </div>
                        <button class="btn-edit" data-date="${date}">تعديل (Edit)</button>
                    </div>
                `;

                // Toggle accordion on header click
                const header = historyItem.querySelector('.history-item-header');
                header.addEventListener('click', () => {
                    historyItem.classList.toggle('expanded');
                });

                // Edit button click
                const editBtn = historyItem.querySelector('.btn-edit');
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // prevent accordion toggle
                    openEditModal(date, log);
                });

                historyListEl.appendChild(historyItem);
            }
        });

        if (foundAny) {
            noHistoryMsg.classList.add('hidden');

            const footer = document.createElement('div');
            footer.className = 'month-total-footer';
            footer.innerHTML = `
                <span>إجمالي إيرادات الشهر</span>
                <span class="month-total-value">${formatCurrency(monthTotalRevenue)} د.ع</span>
            `;
            historyListEl.appendChild(footer);
        } else {
            noHistoryMsg.classList.remove('hidden');
        }
    }

    // Payments View Update
    async function updatePaymentsView() {
        const payments = await getPayments();
        paymentListEl.innerHTML = '';
        const logs = await getLogs();

        let currentBalance = 0; // global balance
        let priorNetBalance = 0; // for carry-over

        const viewingMonthStr = String(paymentViewingDate.getMonth() + 1).padStart(2, '0');
        const viewingPrefix = `${paymentViewingDate.getFullYear()}-${viewingMonthStr}`;
        const viewingDateStart = new Date(paymentViewingDate.getFullYear(), paymentViewingDate.getMonth(), 1);

        paymentMonthDisplay.innerText = getArabicMonthYear(paymentViewingDate);

        // 1. Calculate All-Time Total Revenue and Prior Net Balance
        Object.keys(logs).forEach(date => {
            const log = logs[date];
            const rev = (Number(log.delivered) * Number(log.price)); // Tips excluded
            currentBalance += rev;

            if (new Date(date) < viewingDateStart) {
                priorNetBalance += rev;
            }
        });

        payments.forEach(payment => {
            const amount = Number(payment.amount);
            if (payment.type === 'addition') {
                currentBalance += amount;
            } else if (payment.type === 'withdrawal') {
                currentBalance -= amount;
            }

            if (new Date(payment.date) < viewingDateStart) {
                if (payment.type === 'addition') {
                    priorNetBalance += amount;
                } else if (payment.type === 'withdrawal') {
                    priorNetBalance -= amount;
                }
            }
        });

        // 2. Filter current month payments
        const currentMonthPayments = payments.filter(p => p.date.startsWith(viewingPrefix));

        // Sort descending by date
        const sortedPayments = currentMonthPayments.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

        let foundAny = false;

        sortedPayments.forEach(payment => {
            foundAny = true;
            const amount = Number(payment.amount);

            const paymentItem = document.createElement('div');
            paymentItem.className = 'payment-item';
            const sign = payment.type === 'addition' ? '+' : '-';
            const amountClass = payment.type === 'addition' ? 'addition' : 'withdrawal';

            paymentItem.innerHTML = `
                <div class="payment-item-details">
                    <div class="payment-item-date">${payment.date}</div>
                    ${payment.notes ? `<div class="payment-item-notes">${payment.notes}</div>` : ''}
                    <div class="payment-actions">
                        <button class="btn-icon edit">تعديل</button>
                        <button class="btn-icon delete">حذف</button>
                    </div>
                </div>
                <div class="payment-item-amount ${amountClass}">${sign} ${formatCurrency(amount)} د.ع</div>
            `;

            // Event Listeners for Edit & Delete
            const editBtn = paymentItem.querySelector('.edit');
            const deleteBtn = paymentItem.querySelector('.delete');

            editBtn.addEventListener('click', () => {
                document.getElementById('pay-amount').value = payment.amount;
                document.querySelector('input[name="pay-type"][value="' + payment.type + '"]').checked = true;
                document.getElementById('pay-date').value = payment.date;
                document.getElementById('pay-notes').value = payment.notes || '';
                
                document.getElementById('edit-payment-id').value = payment.id;
                document.getElementById('payment-submit-btn').innerText = 'تحديث الحركة';
                
                document.getElementById('screen-payments').scrollIntoView({ behavior: 'smooth' });
            });

            deleteBtn.addEventListener('click', async () => {
                if (confirm('هل أنت متأكد من حذف هذه الحركة؟')) {
                    await deletePaymentDoc(payment.id);
                    await updatePaymentsView();
                }
            });

            paymentListEl.appendChild(paymentItem);
        });

        // Add Carry-over if priorNetBalance > 0
        if (priorNetBalance > 0) {
            foundAny = true;
            const carryOverItem = document.createElement('div');
            carryOverItem.className = 'payment-item carryover';
            carryOverItem.innerHTML = `
                <div class="payment-item-details">
                    <div class="payment-item-date">الرصيد السابق</div>
                    <div class="payment-item-notes">رصيد مدور من الأشهر السابقة</div>
                </div>
                <div class="payment-item-amount addition">+ ${formatCurrency(priorNetBalance)} د.ع</div>
            `;
            // Append to bottom (chronologically earliest)
            paymentListEl.appendChild(carryOverItem);
        }

        if (foundAny) {
            noPaymentMsg.classList.add('hidden');
        } else {
            noPaymentMsg.classList.remove('hidden');
        }

        // Update Balance UI (Global)
        currentBalanceEl.innerHTML = `${formatCurrency(currentBalance)} <span>د.ع</span>`;
    }

    // Modal Logic
    function openEditModal(date, log) {
        document.getElementById('edit-date').value = date;
        document.getElementById('edit-price').value = log.price;
        document.getElementById('edit-received').value = log.received || 0;
        document.getElementById('edit-delivered').value = log.delivered;
        document.getElementById('edit-tips').value = log.tips;
        document.getElementById('edit-deferred').value = log.deferred;
        document.getElementById('edit-returned').value = log.returned;

        editModal.classList.remove('hidden');
    }

    function closeEditModal() {
        editModal.classList.add('hidden');
    }

    cancelEditBtn.addEventListener('click', closeEditModal);

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const date = document.getElementById('edit-date').value;
        const price = Number(document.getElementById('edit-price').value) || 0;
        const received = Number(document.getElementById('edit-received').value) || 0;
        const delivered = Number(document.getElementById('edit-delivered').value) || 0;
        const tips = Number(document.getElementById('edit-tips').value) || 0;
        const deferred = Number(document.getElementById('edit-deferred').value) || 0;
        const returned = Number(document.getElementById('edit-returned').value) || 0;

        try {
            await saveLog(date, { price, received, delivered, tips, deferred, returned });
        } catch (error) {
            return;
        }
        closeEditModal();

        await updateMainDashboard();
        await updateHistoryView();
        await updatePaymentsView();
    });

    // Month Navigation
    prevMonthBtn.addEventListener('click', async () => {
        viewingDate.setMonth(viewingDate.getMonth() - 1);
        await updateHistoryView();
    });

    nextMonthBtn.addEventListener('click', async () => {
        viewingDate.setMonth(viewingDate.getMonth() + 1);
        await updateHistoryView();
    });

    // Payment Month Navigation
    prevPaymentMonthBtn.addEventListener('click', async () => {
        paymentViewingDate.setMonth(paymentViewingDate.getMonth() - 1);
        await updatePaymentsView();
    });

    nextPaymentMonthBtn.addEventListener('click', async () => {
        paymentViewingDate.setMonth(paymentViewingDate.getMonth() + 1);
        await updatePaymentsView();
    });

    // Main Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const date = logDateInput.value;
        const price = Number(priceInput.value) || 0;
        const received = Number(document.getElementById('received').value) || 0;
        const delivered = Number(document.getElementById('delivered').value) || 0;
        const tips = Number(document.getElementById('tips').value) || 0;
        const deferred = Number(document.getElementById('deferred').value) || 0;
        const returned = Number(document.getElementById('returned').value) || 0;

        try {
            await saveLog(date, { price, received, delivered, tips, deferred, returned });
        } catch (error) {
            return;
        }
        alert('تم حفظ السجل بنجاح!');

        await updateMainDashboard();
        await updateHistoryView(); // Refresh history if viewing current month
        await updatePaymentsView(); // Sync payments balance
        form.reset();

        logDateInput.value = date;
        priceInput.value = price;
    });

    // Payment Form Submission
    paymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const amount = Number(document.getElementById('pay-amount').value) || 0;
        const type = document.querySelector('input[name="pay-type"]:checked').value;
        const date = document.getElementById('pay-date').value;
        const notes = document.getElementById('pay-notes').value.trim();
        const editId = document.getElementById('edit-payment-id').value;

        try {
            if (editId) {
                await updatePaymentDoc(editId, { amount, type, date, notes });
                alert('تم تحديث الحركة بنجاح!');
            } else {
                await savePayment({ amount, type, date, notes });
                alert('تم حفظ الحركة بنجاح!');
            }
        } catch (error) {
            return;
        }

        await updatePaymentsView();
        paymentForm.reset();

        // Restore defaults
        document.querySelector('input[name="pay-type"][value="addition"]').checked = true;
        document.getElementById('pay-date').value = date; // keep date
        document.getElementById('edit-payment-id').value = '';
        document.getElementById('payment-submit-btn').innerText = 'حفظ الحركة';
    });

    // ---- Helpers for Screen 4 (Tracking) ----
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatWhatsAppLink(phone) {
        let cleaned = String(phone).replace(/\D/g, '');
        cleaned = cleaned.replace(/^0+/, '');
        if (!cleaned.startsWith('964')) {
            cleaned = '964' + cleaned;
        }
        return `https://wa.me/${cleaned}`;
    }

    // ---- Extract Latitude & Longitude from Maps / URLs ----
    function extractCoordinates(urlStr) {
        if (!urlStr) return null;
        try {
            const decoded = decodeURIComponent(urlStr);
            const coordRegex = /(-?\d{1,2}\.\d+)\s*[\s,:]\s*(-?\d{1,3}\.\d+)/;
            const match = decoded.match(coordRegex);
            if (match) {
                const lat = parseFloat(match[1]);
                const lng = parseFloat(match[2]);
                if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    return { lat, lng };
                }
            }
        } catch (e) {
            console.error('Error extracting coordinates:', e);
        }
        return null;
    }

    // ---- Area Helpers ----
    async function populateAreaDropdowns() {
        const areas = await getDeliveryAreas();
        const selects = [trackingAddArea, trackingEditArea];
        selects.forEach(select => {
            const currentVal = select.value;
            select.innerHTML = '<option value="">اختر المنطقة</option>';
            areas.forEach(a => {
                const opt = document.createElement('option');
                opt.value = a.name;
                opt.textContent = a.name;
                select.appendChild(opt);
            });
            if (currentVal && [...select.options].some(o => o.value === currentVal)) {
                select.value = currentVal;
            }
        });
    }

    // ---- Tracking DOM References ----
    const trackingListEl = document.getElementById('tracking-list');
    const noTrackingMsg = document.getElementById('no-tracking-msg');
    const trackingSpinner = document.getElementById('tracking-spinner');

    const trackingContactModal = document.getElementById('tracking-contact-modal');
    const trackingContactName = document.getElementById('tracking-contact-name');
    const trackingContactPhone = document.getElementById('tracking-contact-phone');
    const trackingCallBtn = document.getElementById('tracking-call-btn');
    const trackingWaBtn = document.getElementById('tracking-wa-btn');
    const trackingCloseContact = document.getElementById('tracking-close-contact');

    const trackingLocationModal = document.getElementById('tracking-location-modal');
    const trackingLocationAddress = document.getElementById('tracking-location-address');
    const trackingLocationButtons = document.getElementById('tracking-location-buttons');
    const trackingCloseLocation = document.getElementById('tracking-close-location');

    const trackingAddModal = document.getElementById('tracking-add-modal');
    const trackingAddForm = document.getElementById('tracking-add-form');
    const trackingAddDate = document.getElementById('track-add-date');
    const trackingAddArea = document.getElementById('track-add-area');
    const trackingAddCustomer = document.getElementById('track-add-customer');
    const trackingAddPhone = document.getElementById('track-add-phone');
    const trackingAddAddress = document.getElementById('track-add-address');
    const trackingAddLocation = document.getElementById('track-add-location');
    const trackingAddNotes = document.getElementById('track-add-notes');
    const trackingCancelAdd = document.getElementById('tracking-cancel-add');

    const trackingEditModal = document.getElementById('tracking-edit-modal');
    const trackingEditForm = document.getElementById('tracking-edit-form');
    const trackingEditId = document.getElementById('track-edit-id');
    const trackingEditDate = document.getElementById('track-edit-date');
    const trackingEditArea = document.getElementById('track-edit-area');
    const trackingEditCustomer = document.getElementById('track-edit-customer');
    const trackingEditPhone = document.getElementById('track-edit-phone');
    const trackingEditAddress = document.getElementById('track-edit-address');
    const trackingEditLocation = document.getElementById('track-edit-location');
    const trackingEditNotes = document.getElementById('track-edit-notes');
    const trackingCancelEdit = document.getElementById('tracking-cancel-edit');

    // ---- Search Elements ----
    const topActions = document.getElementById('tracking-top-actions');
    const searchContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');

    // ---- View Mode State ----
    let viewMode = localStorage.getItem('viewMode') || 'date-first';
    const toggleViewBtn = document.getElementById('toggle-view-btn');

    // ---- Modal Helpers ----
    function openContactModal(order) {
        const phone = order.phone || '';
        trackingContactName.innerText = order.customer_name || '';
        trackingContactPhone.innerText = phone;
        trackingCallBtn.href = `tel:${phone}`;
        trackingWaBtn.href = formatWhatsAppLink(phone);
        trackingContactModal.classList.remove('hidden');
    }

    function closeContactModal() {
        trackingContactModal.classList.add('hidden');
    }

    function openLocationModal(order) {
        trackingLocationAddress.innerText = order.address || '';
        trackingLocationButtons.innerHTML = '';

        const coords = extractCoordinates(order.location_url);
        const encodedAddr = encodeURIComponent(order.address || '');

        if (coords) {
            const { lat, lng } = coords;
            addMapButton('🗺️ Google Maps', `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
            addMapButton('🍏 Apple Maps', `https://maps.apple.com/?q=${lat},${lng}&ll=${lat},${lng}`);
            addMapButton('🚗 Waze', `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`);
        } else if (order.location_url) {
            addMapButton('🗺️ فتح الرابط', order.location_url);
        } else {
            trackingLocationButtons.innerHTML = '<p style="color: var(--text-muted); padding: 0.5rem 0;">لا يوجد رابط موقع متاح</p>';
        }

        trackingLocationModal.classList.remove('hidden');
    }

    function addMapButton(label, href) {
        const btn = document.createElement('a');
        btn.className = 'tracking-map-btn';
        btn.href = href;
        btn.target = '_blank';
        btn.innerText = label;
        trackingLocationButtons.appendChild(btn);
    }

    function closeLocationModalFn() {
        trackingLocationModal.classList.add('hidden');
    }

    function resetAddForm() {
        trackingAddForm.reset();
        trackingAddDate.value = new Date().toISOString().split('T')[0];
    }

    function openAddModal(date) {
        resetAddForm();
        if (date) trackingAddDate.value = date;
        populateAreaDropdowns().then(() => {
            trackingAddModal.classList.remove('hidden');
        });
    }

    function closeAddModal() {
        trackingAddModal.classList.add('hidden');
        resetAddForm();
    }

    function openEditModalTracking(order) {
        trackingEditId.value = order.id;
        trackingEditDate.value = order.date || '';
        trackingEditCustomer.value = order.customer_name || '';
        trackingEditPhone.value = order.phone || '';
        trackingEditAddress.value = order.address || '';
        trackingEditLocation.value = order.location_url || '';
        trackingEditNotes.value = order.notes || '';
        populateAreaDropdowns().then(() => {
            trackingEditArea.value = order.area || '';
            trackingEditModal.classList.remove('hidden');
        });
    }

    function closeEditModalTracking() {
        trackingEditModal.classList.add('hidden');
    }

    trackingCloseContact.addEventListener('click', closeContactModal);
    trackingCloseLocation.addEventListener('click', closeLocationModalFn);
    trackingCancelAdd.addEventListener('click', closeAddModal);
    trackingCancelEdit.addEventListener('click', closeEditModalTracking);

    const trackingAddMainBtn = document.getElementById('tracking-add-btn');
    if (trackingAddMainBtn) {
        trackingAddMainBtn.addEventListener('click', () => openAddModal());
    }

    // ---- Manage Areas Modal ----
    const manageAreasBtn = document.getElementById('manage-areas-btn');
    const manageAreasModal = document.getElementById('manage-areas-modal');
    const manageAreasList = document.getElementById('manage-areas-list');
    const manageAreasInput = document.getElementById('manage-areas-input');
    const manageAreasAddBtn = document.getElementById('manage-areas-add-btn');
    const manageAreasClose = document.getElementById('manage-areas-close');
    const manageAreasCancel = document.getElementById('manage-areas-cancel');

    function openManageAreasModal() {
        populateAreasList();
        manageAreasModal.classList.remove('hidden');
    }

    function closeManageAreasModal() {
        manageAreasModal.classList.add('hidden');
    }

    async function populateAreasList() {
        const areas = await getDeliveryAreas();
        manageAreasList.innerHTML = '';
        if (!areas || areas.length === 0) {
            manageAreasList.innerHTML = '<p style="color: var(--text-muted); text-align: center;">لا توجد مناطق مضافة</p>';
            return;
        }
        areas.forEach(area => {
            const item = document.createElement('div');
            item.className = 'manage-area-item';
            item.innerHTML = `
                <span>${area.name}</span>
                <button type="button" class="manage-area-delete-btn" data-id="${area.id}" data-name="${area.name}">🗑️</button>
            `;
            manageAreasList.appendChild(item);
        });
        manageAreasList.querySelectorAll('.manage-area-delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const name = btn.dataset.name;
                if (confirm(`هل أنت متأكد من حذف المنطقة (${name})؟`)) {
                    try {
                        await deleteDeliveryArea(id);
                        await populateAreasList();
                        await populateAreaDropdowns();
                    } catch (e) {
                        console.error('Error deleting area:', e);
                    }
                }
            });
        });
    }

    if (manageAreasBtn) {
        manageAreasBtn.addEventListener('click', openManageAreasModal);
    }
    if (manageAreasClose) {
        manageAreasClose.addEventListener('click', closeManageAreasModal);
    }
    if (manageAreasCancel) {
        manageAreasCancel.addEventListener('click', closeManageAreasModal);
    }
    if (manageAreasAddBtn && manageAreasInput) {
        manageAreasAddBtn.addEventListener('click', async () => {
            const name = manageAreasInput.value.trim();
            if (!name) {
                alert('يرجى إدخال اسم المنطقة.');
                return;
            }
            try {
                await saveDeliveryArea(name);
                manageAreasInput.value = '';
                await populateAreasList();
                await populateAreaDropdowns();
            } catch (e) {
                console.error('Error adding area:', e);
            }
        });
        manageAreasInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                manageAreasAddBtn.click();
            }
        });
    }

    // ---- Search: Expand/Collapse Logic ----
    function expandSearch() {
        topActions.classList.add('tracking-search-active');
    }

    function collapseSearch() {
        topActions.classList.remove('tracking-search-active');
        searchInput.value = '';
        clearSearchFilter();
    }

    searchContainer.addEventListener('click', () => {
        searchInput.focus();
    });

    searchInput.addEventListener('focus', expandSearch);

    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            if (!searchInput.value.trim() && topActions.classList.contains('tracking-search-active')) {
                collapseSearch();
            }
        }, 180);
    });

    searchClear.addEventListener('click', (e) => {
        e.stopPropagation();
        collapseSearch();
        searchInput.blur();
    });

    // ---- Search: Real-Time Filtering ----
    function clearSearchFilter() {
        trackingListEl.querySelectorAll('.search-hidden').forEach(el => el.classList.remove('search-hidden'));
        const primaryKey = viewMode === 'date-first' ? 'lastOpenDate' : 'lastOpenPrimary';
        const secondaryKey = viewMode === 'date-first' ? 'lastOpenArea' : 'lastOpenSecondary';
        const savedPrimary = localStorage.getItem(primaryKey);
        const savedSecondary = localStorage.getItem(secondaryKey);
        trackingListEl.querySelectorAll('.tracking-date-accordion').forEach(acc => {
            acc.classList.toggle('expanded', acc.dataset.primary === savedPrimary);
        });
        trackingListEl.querySelectorAll('.tracking-area-collapsible').forEach(el => {
            el.classList.toggle('area-expanded', el.dataset.secondary === savedSecondary);
        });
    }

    searchInput.addEventListener('input', () => {
        const term = searchInput.value.toLowerCase().trim();
        if (!term) {
            clearSearchFilter();
            return;
        }

        const l1Accordions = trackingListEl.querySelectorAll('.tracking-date-accordion');
        l1Accordions.forEach(accord => {
            const l2Sections = accord.querySelectorAll('.tracking-area-collapsible');
            const tableRows = accord.querySelectorAll('.tracking-table-row');
            let accordHasVisible = false;

            if (l2Sections.length > 0) {
                l2Sections.forEach(area => {
                    const cards = area.querySelectorAll('.tracking-order-card');
                    let areaHasVisible = false;

                    cards.forEach(card => {
                        const data = (card.dataset.search || '').toLowerCase();
                        const match = data.includes(term);
                        card.classList.toggle('search-hidden', !match);
                        if (match) {
                            areaHasVisible = true;
                            accordHasVisible = true;
                            area.classList.add('area-expanded');
                            accord.classList.add('expanded');
                        }
                    });

                    area.classList.toggle('search-hidden', !areaHasVisible);
                });
            }

            if (tableRows.length > 0) {
                tableRows.forEach(row => {
                    const name = (row.querySelector('.tt-name')?.textContent || '').toLowerCase();
                    const phone = (row.querySelector('.tt-phone')?.textContent || '').toLowerCase();
                    const match = name.includes(term) || phone.includes(term);
                    row.classList.toggle('search-hidden', !match);
                    if (match) {
                        accordHasVisible = true;
                        accord.classList.add('expanded');
                    }
                });
            }

            accord.classList.toggle('search-hidden', !accordHasVisible);
        });
    });

    // ---- Toggle View Mode ----
    const modeIcons = { 'date-first': '📅', 'area-first': '📍', 'table-view': '📋' };
    toggleViewBtn.addEventListener('click', () => {
        const modes = ['date-first', 'area-first', 'table-view'];
        const idx = modes.indexOf(viewMode);
        viewMode = modes[(idx + 1) % modes.length];
        localStorage.setItem('viewMode', viewMode);
        toggleViewBtn.textContent = modeIcons[viewMode] || '🔄';
        toggleViewBtn.title = viewMode === 'date-first' ? 'عرض حسب التاريخ' : viewMode === 'area-first' ? 'عرض حسب المنطقة' : 'عرض جدولي';
        updateTrackingView();
    });
    // Set initial icon
    toggleViewBtn.textContent = modeIcons[viewMode] || '🔄';

    // ---- Tracking Add Form Submit ----
    trackingAddForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const date = trackingAddDate.value;
        const area = trackingAddArea.value.trim();
        const customer_name = trackingAddCustomer.value.trim();
        const phone = trackingAddPhone.value.trim();
        const address = trackingAddAddress.value.trim();
        const location_url = trackingAddLocation.value.trim();
        const notes = trackingAddNotes.value.trim();

        if (!date || !area || !customer_name || !phone) {
            alert('يرجى ملء التاريخ والمنطقة واسم العميل ورقم الهاتف.');
            return;
        }

        try {
            await saveTrackingOrder({
                date,
                area,
                customer_name,
                phone,
                address: address || '',
                location_url: location_url || '',
                notes: notes || '',
                status: 'قيد التسليم'
            });
        } catch (error) {
            return;
        }
        alert('تم إضافة الطلب بنجاح!');
        closeAddModal();
        await updateTrackingView();
    });

    // ---- Tracking Edit Form Submit ----
    trackingEditForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = trackingEditId.value;
        const date = trackingEditDate.value;
        const area = trackingEditArea.value.trim();
        const customer_name = trackingEditCustomer.value.trim();
        const phone = trackingEditPhone.value.trim();
        const address = trackingEditAddress.value.trim();
        const location_url = trackingEditLocation.value.trim();
        const notes = trackingEditNotes.value.trim();

        if (!id || !date || !area || !customer_name || !phone) {
            alert('يرجى ملء جميع الحقول المطلوبة.');
            return;
        }

        try {
            await updateTrackingOrder(id, {
                date,
                area,
                customer_name,
                phone,
                address: address || '',
                location_url: location_url || '',
                notes: notes || ''
            });
        } catch (error) {
            return;
        }
        alert('تم تحديث الطلب بنجاح!');
        closeEditModalTracking();
        await updateTrackingView();
    });

    // ---- Create Order Card ----
    function createTrackingOrderCard(order) {
        const card = document.createElement('div');
        card.className = 'tracking-order-card';
        card.dataset.id = order.id;
        card.dataset.search = `${order.customer_name || ''}|${order.phone || ''}`.toLowerCase();

        const statusColors = {
            'قيد التسليم': '#059669',
            'مؤجل': '#d97706',
            'راجع': '#dc2626',
            'واصل': '#1d4ed8'
        };

        const safeName = escapeHtml(order.customer_name);
        const safePhone = escapeHtml(order.phone);
        const safeAddress = escapeHtml(order.address);

        // Extract just phone digits for display
        const phoneDisplay = order.phone || '';

        card.innerHTML = `
            <div class="tracking-card-header">
                <span class="tracking-customer-name">${safeName}</span>
                <span class="tracking-status-badge" style="background: ${statusColors[order.status] || '#6b7280'}">${escapeHtml(order.status)}</span>
            </div>
            <div class="tracking-card-body">
                <div class="tracking-card-phone">📞 ${phoneDisplay}</div>
                <div class="tracking-card-address">📍 ${safeAddress || 'لا يوجد عنوان'}</div>
                ${order.notes ? `<div class="tracking-card-notes">📝 ${escapeHtml(order.notes)}</div>` : ''}
            </div>
            <div class="tracking-card-actions">
                <select class="tracking-status-select">
                    <option value="قيد التسليم" ${order.status === 'قيد التسليم' ? 'selected' : ''}>قيد التسليم</option>
                    <option value="مؤجل" ${order.status === 'مؤجل' ? 'selected' : ''}>مؤجل</option>
                    <option value="راجع" ${order.status === 'راجع' ? 'selected' : ''}>راجع</option>
                    <option value="واصل" ${order.status === 'واصل' ? 'selected' : ''}>واصل</option>
                </select>
                <button class="tracking-edit-btn">تعديل</button>
                <button class="tracking-delete-btn">🗑️ تصفية</button>
            </div>
        `;

        // Customer name -> contact modal
        card.querySelector('.tracking-customer-name').addEventListener('click', () => {
            openContactModal(order);
        });

        // Phone -> contact modal
        card.querySelector('.tracking-card-phone').addEventListener('click', () => {
            openContactModal(order);
        });

        // Address -> location modal
        card.querySelector('.tracking-card-address').addEventListener('click', () => {
            openLocationModal(order);
        });

        // Status change
        card.querySelector('.tracking-status-select').addEventListener('change', async (e) => {
            const newStatus = e.target.value;
            try {
                await updateTrackingOrder(order.id, { status: newStatus });
                await updateTrackingView();
            } catch (error) {
                console.error('Error updating status:', error);
            }
        });

        // Edit button
        card.querySelector('.tracking-edit-btn').addEventListener('click', () => {
            openEditModalTracking(order);
        });

        // Delete button
        card.querySelector('.tracking-delete-btn').addEventListener('click', async () => {
            if (confirm(`هل أنت متأكد من حذف طلب (${order.customer_name})؟`)) {
                try {
                    await deleteTrackingOrder(order.id);
                    await updateTrackingView();
                } catch (error) {
                    console.error('Error deleting order:', error);
                }
            }
        });

        return card;
    }

    // ---- Render Tracking View ----
    async function updateTrackingView() {
        const isFirstLoad = cachedTrackingOrders === null;
        if (isFirstLoad && trackingSpinner) {
            trackingSpinner.classList.remove('hidden');
        }

        const orders = await getTrackingOrders();

        if (trackingSpinner) {
            trackingSpinner.classList.add('hidden');
        }

        trackingListEl.innerHTML = '';

        if (!orders || orders.length === 0) {
            noTrackingMsg.classList.remove('hidden');
            return;
        }
        noTrackingMsg.classList.add('hidden');

        if (viewMode === 'date-first') {
            renderDateFirst(orders);
        } else if (viewMode === 'area-first') {
            renderAreaFirst(orders);
        } else {
            renderTableView(orders);
        }
    }

    function renderDateFirst(orders) {
        const primaryKey = 'lastOpenDate';
        const secondaryKey = 'lastOpenArea';
        const savedPrimary = localStorage.getItem(primaryKey);
        const savedSecondary = localStorage.getItem(secondaryKey);

        const byDate = {};
        orders.forEach(order => {
            const d = order.date || 'بدون تاريخ';
            if (!byDate[d]) byDate[d] = {};
            const a = order.area || 'منطقة أخرى';
            if (!byDate[d][a]) byDate[d][a] = [];
            byDate[d][a].push(order);
        });

        const sortedDates = Object.keys(byDate).sort().reverse();

        sortedDates.forEach(date => {
            const accordion = document.createElement('div');
            accordion.className = 'tracking-date-accordion';
            accordion.dataset.primary = date;

            const header = document.createElement('div');
            header.className = 'tracking-date-header';
            header.innerHTML = `📅 طلبات يوم ${date} <span class="tracking-toggle">▼</span>`;

            const content = document.createElement('div');
            content.className = 'tracking-date-content';

            header.addEventListener('click', () => {
                accordion.classList.toggle('expanded');
                if (accordion.classList.contains('expanded')) {
                    localStorage.setItem(primaryKey, date);
                } else {
                    localStorage.removeItem(primaryKey);
                    localStorage.removeItem(secondaryKey);
                }
            });

            if (savedPrimary === date) {
                accordion.classList.add('expanded');
            }

            accordion.appendChild(header);
            accordion.appendChild(content);

            const areas = Object.keys(byDate[date]).sort();
            areas.forEach(area => {
                const areaSection = document.createElement('div');
                areaSection.className = 'tracking-area-section tracking-area-collapsible';
                areaSection.dataset.secondary = area;

                const areaTitle = document.createElement('div');
                areaTitle.className = 'tracking-area-header';
                areaTitle.innerHTML = `📍 ${area} <span class="tracking-area-toggle">▼</span>`;

                const cardsWrapper = document.createElement('div');
                cardsWrapper.className = 'tracking-order-cards';

                byDate[date][area].forEach(order => {
                    cardsWrapper.appendChild(createTrackingOrderCard(order));
                });

                areaTitle.addEventListener('click', () => {
                    areaSection.classList.toggle('area-expanded');
                    if (areaSection.classList.contains('area-expanded')) {
                        localStorage.setItem(secondaryKey, area);
                    } else {
                        localStorage.removeItem(secondaryKey);
                    }
                });

                if (savedSecondary === area) {
                    areaSection.classList.add('area-expanded');
                }

                areaSection.appendChild(areaTitle);
                areaSection.appendChild(cardsWrapper);

                const addBtn = document.createElement('button');
                addBtn.className = 'tracking-add-order-btn';
                addBtn.innerText = '+ إضافة طلب جديد';
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openAddModal(date);
                });
                areaSection.appendChild(addBtn);

                content.appendChild(areaSection);
            });

            trackingListEl.appendChild(accordion);
        });
    }

    function renderAreaFirst(orders) {
        const primaryKey = 'lastOpenPrimary';
        const secondaryKey = 'lastOpenSecondary';
        const savedPrimary = localStorage.getItem(primaryKey);
        const savedSecondary = localStorage.getItem(secondaryKey);

        const byArea = {};
        orders.forEach(order => {
            const a = order.area || 'منطقة أخرى';
            if (!byArea[a]) byArea[a] = {};
            const d = order.date || 'بدون تاريخ';
            if (!byArea[a][d]) byArea[a][d] = [];
            byArea[a][d].push(order);
        });

        const sortedAreas = Object.keys(byArea).sort();

        sortedAreas.forEach(area => {
            const accordion = document.createElement('div');
            accordion.className = 'tracking-date-accordion';
            accordion.dataset.primary = area;

            const header = document.createElement('div');
            header.className = 'tracking-date-header';
            header.innerHTML = `📍 ${area} <span class="tracking-toggle">▼</span>`;

            const content = document.createElement('div');
            content.className = 'tracking-date-content';

            header.addEventListener('click', () => {
                accordion.classList.toggle('expanded');
                if (accordion.classList.contains('expanded')) {
                    localStorage.setItem(primaryKey, area);
                } else {
                    localStorage.removeItem(primaryKey);
                    localStorage.removeItem(secondaryKey);
                }
            });

            if (savedPrimary === area) {
                accordion.classList.add('expanded');
            }

            accordion.appendChild(header);
            accordion.appendChild(content);

            const dates = Object.keys(byArea[area]).sort().reverse();
            dates.forEach(date => {
                const dateSection = document.createElement('div');
                dateSection.className = 'tracking-area-section tracking-area-collapsible';
                dateSection.dataset.secondary = date;

                const dateTitle = document.createElement('div');
                dateTitle.className = 'tracking-area-header';
                dateTitle.innerHTML = `📅 طلبات يوم ${date} <span class="tracking-area-toggle">▼</span>`;

                const cardsWrapper = document.createElement('div');
                cardsWrapper.className = 'tracking-order-cards';

                byArea[area][date].forEach(order => {
                    cardsWrapper.appendChild(createTrackingOrderCard(order));
                });

                dateTitle.addEventListener('click', () => {
                    dateSection.classList.toggle('area-expanded');
                    if (dateSection.classList.contains('area-expanded')) {
                        localStorage.setItem(secondaryKey, date);
                    } else {
                        localStorage.removeItem(secondaryKey);
                    }
                });

                if (savedSecondary === date) {
                    dateSection.classList.add('area-expanded');
                }

                dateSection.appendChild(dateTitle);
                dateSection.appendChild(cardsWrapper);

                const addBtn = document.createElement('button');
                addBtn.className = 'tracking-add-order-btn';
                addBtn.innerText = '+ إضافة طلب جديد';
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openAddModal(date);
                });
                dateSection.appendChild(addBtn);

                content.appendChild(dateSection);
            });

            trackingListEl.appendChild(accordion);
        });
    }

    function renderTableView(orders) {
        const primaryKey = 'lastOpenDate';
        const savedPrimary = localStorage.getItem(primaryKey);

        const tableStatusBg = {
            'قيد التسليم': '',
            'مؤجل': '#f3f4f6',
            'واصل': '#dcfce7',
            'راجع': '#fee2e2'
        };

        const byDate = {};
        orders.forEach(order => {
            const d = order.date || 'بدون تاريخ';
            if (!byDate[d]) byDate[d] = [];
            byDate[d].push(order);
        });

        const sortedDates = Object.keys(byDate).sort().reverse();

        sortedDates.forEach(date => {
            const accordion = document.createElement('div');
            accordion.className = 'tracking-date-accordion';
            accordion.dataset.primary = date;

            const header = document.createElement('div');
            header.className = 'tracking-date-header';
            header.innerHTML = `📅 طلبات يوم ${date} <span class="tracking-toggle">▼</span>`;

            const content = document.createElement('div');
            content.className = 'tracking-date-content';

            header.addEventListener('click', () => {
                accordion.classList.toggle('expanded');
                if (accordion.classList.contains('expanded')) {
                    localStorage.setItem(primaryKey, date);
                } else {
                    localStorage.removeItem(primaryKey);
                }
            });

            if (savedPrimary === date) {
                accordion.classList.add('expanded');
            }

            accordion.appendChild(header);
            accordion.appendChild(content);

            byDate[date].forEach(order => {
                const row = document.createElement('div');
                row.className = 'tracking-table-row';

                const bg = tableStatusBg[order.status] || '';
                if (bg) row.style.backgroundColor = bg;

                const safeName = escapeHtml(order.customer_name);
                const safePhone = escapeHtml(order.phone);
                const safeArea = escapeHtml(order.area);
                const safeAddress = escapeHtml(order.address);
                const safeNotes = escapeHtml(order.notes);

                row.innerHTML = `
                    <div class="tt-col tt-col-contact">
                        <div class="tt-name">${safeName}</div>
                        <div class="tt-phone">📞 ${safePhone}</div>
                    </div>
                    <div class="tt-col tt-col-location">
                        <div class="tt-area">📍 ${safeArea}</div>
                        <div class="tt-address">${safeAddress || 'لا يوجد عنوان'}</div>
                    </div>
                    <div class="tt-col tt-col-actions">
                        ${safeNotes ? `<div class="tt-notes">📝 ${safeNotes}</div>` : ''}
                        <div class="tt-action-row">
                            <select class="tracking-status-select tt-status">
                                <option value="قيد التسليم" ${order.status === 'قيد التسليم' ? 'selected' : ''}>قيد التسليم</option>
                                <option value="مؤجل" ${order.status === 'مؤجل' ? 'selected' : ''}>مؤجل</option>
                                <option value="راجع" ${order.status === 'راجع' ? 'selected' : ''}>راجع</option>
                                <option value="واصل" ${order.status === 'واصل' ? 'selected' : ''}>واصل</option>
                            </select>
                            <div class="tt-action-buttons">
                                <button class="tracking-edit-btn tt-edit">✏️</button>
                                <button class="tracking-delete-btn tt-delete">🗑️</button>
                            </div>
                        </div>
                    </div>
                `;

                row.querySelector('.tt-col-contact').addEventListener('click', () => {
                    openContactModal(order);
                });

                row.querySelector('.tt-col-location').addEventListener('click', () => {
                    openLocationModal(order);
                });

                row.querySelector('.tt-status').addEventListener('change', async (e) => {
                    const newStatus = e.target.value;
                    try {
                        await updateTrackingOrder(order.id, { status: newStatus });
                        await updateTrackingView();
                    } catch (error) {
                        console.error('Error updating status:', error);
                    }
                });

                row.querySelector('.tt-edit').addEventListener('click', () => {
                    openEditModalTracking(order);
                });

                row.querySelector('.tt-delete').addEventListener('click', async () => {
                    if (confirm(`هل أنت متأكد من حذف طلب (${order.customer_name})؟`)) {
                        try {
                            await deleteTrackingOrder(order.id);
                            await updateTrackingView();
                        } catch (error) {
                            console.error('Error deleting order:', error);
                        }
                    }
                });

                content.appendChild(row);
            });

            trackingListEl.appendChild(accordion);
        });
    }

    // Initialization
    async function init() {
        setLoading(true);
        try {
            await checkCarryOver();
            await updateMainDashboard();
            await updateHistoryView();
            await updatePaymentsView();
            await updateTrackingView();
        } catch (error) {
            console.error('Initialization error:', error);
        } finally {
            setLoading(false);
        }
    }

    init();
});
