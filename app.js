import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, doc, getDocs, setDoc, addDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

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
            const rev = (Number(log.delivered) * Number(log.price)) + Number(log.tips);
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
                </div>
                <div class="payment-item-amount ${amountClass}">${sign} ${formatCurrency(amount)} د.ع</div>
            `;

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

        try {
            await savePayment({ amount, type, date, notes });
        } catch (error) {
            return;
        }
        alert('تم حفظ الحركة بنجاح!');

        await updatePaymentsView();
        paymentForm.reset();

        // Restore defaults
        document.querySelector('input[name="pay-type"][value="addition"]').checked = true;
        payDateInput.value = date; // keep date
    });

    // Initialization
    async function init() {
        setLoading(true);
        try {
            await checkCarryOver();
            await updateMainDashboard();
            await updateHistoryView();
            await updatePaymentsView();
        } catch (error) {
            console.error('Initialization error:', error);
        } finally {
            setLoading(false);
        }
    }

    init();
});
