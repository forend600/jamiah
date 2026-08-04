// ==========================================
// 1. CONSTANTS & INITIAL DATA
// ==========================================
const ARABIC_MONTHS = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const CURRENT_DATE = new Date();
const DEFAULT_YEAR = CURRENT_DATE.getFullYear();
const CURRENT_MONTH_INDEX = CURRENT_DATE.getMonth(); // 0 to 11

const STORAGE_KEY_TRANSACTIONS = "family_fund_transactions";
const STORAGE_KEY_MEMBERS = "family_fund_members";
const STORAGE_KEY_YEARS = "family_fund_years";

// ==========================================
// 2. GOOGLE SHEETS BACKUP PLACEHOLDER (INACTIVE)
// ==========================================
const GOOGLE_SHEETS_CONFIG = {
    enabled: false, // Change to true when activating Google Sheets backup
    webAppUrl: ""   // Insert Google Apps Script Web App URL here later
};

async function syncToGoogleSheetsPlaceholder(action, data) {
    if (!GOOGLE_SHEETS_CONFIG.enabled || !GOOGLE_SHEETS_CONFIG.webAppUrl) {
        return; // Inactive placeholder - reserved for future implementation
    }
    
    try {
        await fetch(GOOGLE_SHEETS_CONFIG.webAppUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, data, timestamp: new Date().toISOString() })
        });
    } catch (err) {
        console.warn("Google Sheets Sync Placeholder Error:", err);
    }
}

// ==========================================
// 3. DATA STORAGE WRAPPERS (Google Sheets Ready)
// ==========================================
function loadTransactions() {
    const data = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
    return data ? JSON.parse(data) : [];
}

function saveTransaction(transaction) {
    const transactions = loadTransactions();
    transactions.push(transaction);
    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
    
    // Backup hook
    syncToGoogleSheetsPlaceholder("SAVE_TRANSACTION", transaction);
}

function loadMembers() {
    const data = localStorage.getItem(STORAGE_KEY_MEMBERS);
    return data ? JSON.parse(data) : [];
}

function saveMember(member) {
    const members = loadMembers();
    members.push(member);
    localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(members));
    
    // Backup hook
    syncToGoogleSheetsPlaceholder("SAVE_MEMBER", member);
}

function loadYears() {
    const data = localStorage.getItem(STORAGE_KEY_YEARS);
    return data ? JSON.parse(data) : [DEFAULT_YEAR];
}

function saveYear(year) {
    const years = loadYears();
    if (!years.includes(year)) {
        years.push(year);
        years.sort((a, b) => b - a);
        localStorage.setItem(STORAGE_KEY_YEARS, JSON.stringify(years));
    }
}

// ==========================================
// 4. APP STATE & INITIALIZATION
// ==========================================
let currentYear = DEFAULT_YEAR;
let editingTransactionId = null;

document.addEventListener("DOMContentLoaded", () => {
    initYearSelector();
    initMonthSelector();
    renderMemberDropdown();
    initEventListeners();
    renderActiveTab();
});

// ==========================================
// 5. UI INITIALIZATION & POPULATION
// ==========================================
function initYearSelector() {
    const yearSelect = document.getElementById("year-select");
    const reportYearSelect = document.getElementById("report-year-select");
    const entryYearSelect = document.getElementById("entry-year");
    const years = loadYears();
    
    if (!years.includes(DEFAULT_YEAR)) {
        saveYear(DEFAULT_YEAR);
        years.push(DEFAULT_YEAR);
        years.sort((a, b) => b - a);
    }
    
    let optionsHTML = "";
    years.forEach(year => {
        optionsHTML += `<option value="${year}">${year}</option>`;
    });

    if (yearSelect) {

        yearSelect.innerHTML = optionsHTML;
    
        yearSelect.value = currentYear;
    
    }
    
    if(reportYearSelect){
    
        reportYearSelect.innerHTML = optionsHTML;
    
        reportYearSelect.value = currentYear;
    
    }
    
    if (entryYearSelect) {
        entryYearSelect.innerHTML = optionsHTML;
        entryYearSelect.value = DEFAULT_YEAR;
    }
}

function initMonthSelector() {
    const monthSelect = document.getElementById("month-select");
    monthSelect.innerHTML = "";
    ARABIC_MONTHS.forEach((month, index) => {
        const option = document.createElement("option");
        option.value = month;
        option.textContent = month;
        if (index === CURRENT_MONTH_INDEX) {
            option.selected = true; // التحديد التلقائي للشهر الحالي
        }
        monthSelect.appendChild(option);
    });
}
function renderMemberDropdown() {
    const memberSelect = document.getElementById("member-select");
    const members = loadMembers();
    
    memberSelect.innerHTML = `
        <option value="">اختر العضو...</option>
        <option value="ADD_NEW">+ إضافة عضو</option>
    `;

    members.forEach(member => {
        const option = document.createElement("option");
        option.value = member.id;
        option.textContent = `#${member.id} - ${member.name}`;
        memberSelect.appendChild(option);
    });
}

// ==========================================
// 6. EVENT LISTENERS
// ==========================================
function initEventListeners() {
    // Tab Switching
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
            
            e.target.classList.add("active");
            const targetTab = e.target.getAttribute("data-tab");
            document.getElementById(targetTab).classList.add("active");
            
            renderActiveTab();
        });
    });

    // Year Change
    document.getElementById("year-select").addEventListener("change",(e)=>{

        currentYear=parseInt(e.target.value);
    
        document.getElementById("report-year-select").value=currentYear;
    
        renderActiveTab();
    
    });
    
    document.getElementById("report-year-select").addEventListener("change",(e)=>{
    
        currentYear=parseInt(e.target.value);
    
        document.getElementById("year-select").value=currentYear;
    
        renderActiveTab();
    
    });

    // Add Year Button
    document.getElementById("add-year-btn").addEventListener("click", () => {
        const newYearStr = prompt("أدخل السنة الجديدة:");
        if (newYearStr) {
            const newYear = parseInt(newYearStr, 10);
            if (!isNaN(newYear) && newYear > 1900 && newYear < 2100) {
                saveYear(newYear);
                currentYear = newYear;
                initYearSelector();
                renderActiveTab();
            } else {
                alert("يرجى إدخال سنة صالحة.");
            }
        }
    });

    // Type Change Listener (Member requirement rules)
    document.getElementById("type-select").addEventListener("change", (e) => {
        const type = e.target.value;
        const memberRequired = document.getElementById("member-required");
        const memberSelect = document.getElementById("member-select");
        
        if (type === "الجمعية") {
            memberRequired.style.display = "inline";
            memberSelect.required = true;
        } else {
            memberRequired.style.display = "none";
            memberSelect.required = false;
        }
    });

    // Member Dropdown Change Listener
    document.getElementById("member-select").addEventListener("change", (e) => {
        if (e.target.value === "ADD_NEW") {
            openMemberModal();
        }
    });

    // Member Modal Controls
    document.getElementById("save-member-btn").addEventListener("click", handleAddMember);
    document.getElementById("cancel-member-btn").addEventListener("click", closeMemberModal);

    // Form Submit
    document.getElementById("entry-form").addEventListener("submit", handleFormSubmit);
}

// ==========================================
// 7. MEMBER MODAL HANDLERS
// ==========================================
function openMemberModal() {
    document.getElementById("member-modal").classList.remove("hidden");
    document.getElementById("new-member-name").value = "";
    document.getElementById("new-member-name").focus();
}

function closeMemberModal() {
    document.getElementById("member-modal").classList.add("hidden");
    document.getElementById("member-select").value = "";
}

function handleAddMember() {
    const input = document.getElementById("new-member-name");
    const name = input.value.trim();
    
    if (!name) {
        alert("يرجى إدخال اسم العضو.");
        return;
    }

    const members = loadMembers();
    const newId = members.length > 0 ? Math.max(...members.map(m => m.id)) + 1 : 1;
    const newMember = { id: newId, name: name };

    saveMember(newMember);
    renderMemberDropdown();
    
    document.getElementById("member-select").value = newId;
    closeMemberModal();
}

// ==========================================
// 8. FORM SUBMISSION HANDLER
// ==========================================
function handleFormSubmit(e) {
    e.preventDefault();

    const entryYear = parseInt(document.getElementById("entry-year").value, 10);
    const type = document.getElementById("type-select").value;
    const month = document.getElementById("month-select").value;
    const memberVal = document.getElementById("member-select").value;
    const amount = parseFloat(document.getElementById("amount-input").value);
    const description = document.getElementById("description-input").value.trim();

    if (type === "الجمعية" && (!memberVal || memberVal === "ADD_NEW")) {
        showAlert("يرجى اختيار عضو للعملية من نوع الجمعية.", "danger");
        return;
    }

    const newTransaction = {
        id: Date.now(),
        year: entryYear,
        month: month,
        type: type,
        member: memberVal && memberVal !== "ADD_NEW" ? parseInt(memberVal, 10) : null,
        amount: amount,
        description: description
    };
    if(type==="الجمعية"){
    
        const exists=loadTransactions().find(t=>
    
            t.type==="الجمعية" &&
            t.year===entryYear &&
            t.month===month &&
            t.member===parseInt(memberVal)
    
        );
    
        if(exists){
    
            if(!confirm("هذا العضو لديه دفعة لهذا الشهر.\nهل تريد إضافة دفعة أخرى؟"))
                return;
    
        }
    
    }
    const wasEditing = editingTransactionId !== null;

if(wasEditing){

    const data=loadTransactions();

    const index=data.findIndex(t=>t.id===editingTransactionId);

    newTransaction.id=editingTransactionId;

    data[index]=newTransaction;

    localStorage.setItem(
        STORAGE_KEY_TRANSACTIONS,
        JSON.stringify(data)
    );

    editingTransactionId=null;

    document.querySelector("#entry-form button[type='submit']").textContent="حفظ العملية";

}else{

    saveTransaction(newTransaction);

}
        
    
    // Reset Form
    document.getElementById("entry-form").reset();
    document.getElementById("entry-year").value=entryYear;
    document.getElementById("month-select").selectedIndex=CURRENT_MONTH_INDEX;
    document.getElementById("type-select").dispatchEvent(new Event("change"));
    
    showAlert(
wasEditing
?

"تم تعديل العملية بنجاح!"

:

"تم حفظ العملية بنجاح!"
        ,"success");
}

function showAlert(message, type) {
    const alertBox = document.getElementById("alert-message");
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type}`;
    alertBox.classList.remove("hidden");
    
    setTimeout(() => {
        alertBox.classList.add("hidden");
    }, 3000);
}

// ==========================================
// 9. OPENING BALANCE CALCULATION
// ==========================================
// Calculates carried forward balance from all previous years prior to currentYear
function getOpeningBalance(year){

    const all=loadTransactions();

    let income=0;
    let expenses=0;
    let others=0;

    all.forEach(t=>{

        if(t.year>=year) return;

        if(t.type==="الجمعية")
            income+=t.amount;

        else if(t.type==="المصروفات")
            expenses+=t.amount;

        else
            others+=t.amount;

    });

    return income-expenses-others;

}
function getMemberOpeningBalance(memberId, year) {
    const allTransactions = loadTransactions();
    return allTransactions
        .filter(t => t.member === memberId && t.type === "الجمعية" && t.year < year)
        .reduce((sum, t) => sum + t.amount, 0);
}

// ==========================================
// 10. TAB RENDERING LOGIC
// ==========================================
function renderActiveTab() {
    const activeTabId = document.querySelector(".tab-content.active").id;

    if (activeTabId === "transactions-tab") {
        renderTransactionsTab();
    } else if (activeTabId === "reports-tab") {
        renderReportsTab();
    }
}

// --- TRANSACTIONS TAB ---
function renderTransactionsTab() {
    const transactions = loadTransactions().filter(t => t.year === currentYear);
    const members = loadMembers();
    
    document.getElementById("opening-balance-value").textContent =
        getOpeningBalance(currentYear).toFixed(2);
    
    renderAssociationTable(transactions, members);
    renderStandardTable("المصروفات", "expenses-table-body", "expenses-year-total", transactions, members);
    renderStandardTable("أخرى", "others-table-body", "others-year-total", transactions, members);
}

function renderAssociationTable(transactions, members) {
    const headerRow = document.getElementById("association-header-row");
    const tbody = document.getElementById("association-table-body");
    
    // Build Header: ID | Member | Opening Balance | Jan .. Dec | Total
    let headerHTML = `<th class="col-id">ID</th><th class="col-name">العضو</th>`;
    ARABIC_MONTHS.forEach(m => {
        headerHTML += `<th class="month-header-cell">${m}</th>`;
    });
    headerHTML += `<th class="month-header-cell">الإجمالي</th>`;
    headerRow.innerHTML = headerHTML;

    // Filter Association Transactions for current year
    const assocTxns = transactions.filter(t => t.type === "الجمعية");

    tbody.innerHTML = "";
    if (members.length === 0) {
        tbody.innerHTML = `<tr><td colspan="16" style="text-align:center;">لا يوجد أعضاء مضافون.</td></tr>`;
        return;
    }

    members.forEach(member => {
        let unpaidCount = 0;
        
        let currentYearSum = 0;
        let cellsHTML = "";

        const allTransactions = loadTransactions();

        ARABIC_MONTHS.forEach((month, index) => {
        
            const txns = assocTxns.filter(t =>
                t.member === member.id &&
                t.month === month
            );
        
            const monthSum = txns.reduce((acc, curr) => acc + curr.amount, 0);
        
            if (monthSum > 0) {
                currentYearSum += monthSum;
                cellsHTML += `<td class="paid-cell">${monthSum.toFixed(2)}</td>`;
            } else {
        
                cellsHTML += `<td class="unpaid-cell">-</td>`;
            }
        
        });
        
        
        /* ---------- calculate badge from ALL years ---------- */
        
        const years = loadYears();
        
        years.forEach(year => {
        
            ARABIC_MONTHS.forEach((month,index)=>{
        
                if(year > DEFAULT_YEAR)
                    return;
        
                if(year===DEFAULT_YEAR && index>CURRENT_MONTH_INDEX)
                    return;
        
                const paid = allTransactions.some(t=>
        
                    t.type==="الجمعية" &&
                    t.member===member.id &&
                    t.year===year &&
                    t.month===month
        
                );
        
                if(!paid)
                    unpaidCount++;
        
            });
        
        });

        const totalBalance = currentYearSum;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="col-id">${member.id}</td>
            <td class="col-name">
                <div class="name-cell-wrapper">
                    <span>${member.name}</span>
                    ${unpaidCount > 0 ? `<span class="unpaid-badge" title="${unpaidCount} أشهر غير مدفوعة">${unpaidCount}</span>` : ''}
                </div>
            </td>
            
            ${cellsHTML}
            <td><strong>${totalBalance.toFixed(2)}</strong></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderStandardTable(type, tbodyId, totalId, transactions, members) {
    const tbody = document.getElementById(tbodyId);
    const totalElem = document.getElementById(totalId);
    
    const filteredTxns = transactions.filter(t => t.type === type);
    tbody.innerHTML = "";
    
    let total = 0;

    if (filteredTxns.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">لا توجد عمليات مسجلة.</td></tr>`;
        totalElem.textContent = "0.00";
        return;
    }

    filteredTxns.forEach(t => {
        total += t.amount;
        const memberObj = members.find(m => m.id === t.member);
        const memberName = memberObj ? memberObj.name : "-";

        const tr = document.createElement("tr");
        
        tr.innerHTML = `
            <td>${t.month}</td>
            <td>${t.description || "-"}</td>
            <td>${memberName}</td>
            <td>${t.amount.toFixed(2)}</td>
            <td>
                <button type="button"
                    class="edit-btn"
                    data-id="${t.id}">
                    ✏️
                </button>
            
                <button type="button"
                    class="delete-btn"
                    data-id="${t.id}">
                    🗑
                </button>
            </td>
        `;
        
        tbody.appendChild(tr);
                tr.querySelector(".edit-btn").addEventListener("click", function(e){
        
            e.stopPropagation();
        
            editTransaction(
                Number(this.dataset.id)
            );
        
        });
        
        tr.querySelector(".delete-btn").addEventListener("click", function(e){
        
            e.stopPropagation();
        
            deleteTransaction(
                Number(this.dataset.id)
            );
        
        });
    });

    totalElem.textContent = total.toFixed(2);
}

// --- REPORTS TAB ---
function renderReportsTab() {
    const transactions = loadTransactions().filter(t => t.year === currentYear);

    let totalIncome = getOpeningBalance(currentYear);
    let totalExpenses = 0;
    let totalOthers = 0;

    transactions.forEach(t => {
        if (t.type === "الجمعية") totalIncome += t.amount;
        else if (t.type === "المصروفات") totalExpenses += t.amount;
        else if (t.type === "أخرى") totalOthers += t.amount;
    });

    const savings = totalIncome - totalExpenses - totalOthers;

    document.getElementById("total-income-val").textContent = totalIncome.toFixed(2);
    document.getElementById("total-expenses-val").textContent = totalExpenses.toFixed(2);
    document.getElementById("total-others-val").textContent = totalOthers.toFixed(2);
    document.getElementById("total-savings-val").textContent = savings.toFixed(2);

    // Render Monthly Summary Table
    const tbody = document.getElementById("monthly-summary-body");
    tbody.innerHTML = "";

    ARABIC_MONTHS.forEach(month => {
        const monthTxns = transactions.filter(t => t.month === month);
        
        let mIncome = 0;
        let mExpenses = 0;
        let mOthers = 0;

        monthTxns.forEach(t => {
            if (t.type === "الجمعية") mIncome += t.amount;
            else if (t.type === "المصروفات") mExpenses += t.amount;
            else if (t.type === "أخرى") mOthers += t.amount;
        });

        const mNet = mIncome - mExpenses - mOthers;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${month}</strong></td>
            <td>${mIncome.toFixed(2)}</td>
            <td>${mExpenses.toFixed(2)}</td>
            <td>${mOthers.toFixed(2)}</td>
            <td style="font-weight: bold; color: ${mNet >= 0 ? '#2e7d32' : '#c62828'};">
                ${mNet.toFixed(2)}
            </td>
        `;
        tbody.appendChild(tr);
    });
}
function deleteTransaction(id){

    if(!confirm("حذف العملية؟"))
        return;

    let data=loadTransactions();

    data=data.filter(t=>t.id!==id);

    localStorage.setItem(
        STORAGE_KEY_TRANSACTIONS,
        JSON.stringify(data)
    );

    renderActiveTab();

}

function editTransaction(id){

    const data = loadTransactions();

    const t = data.find(x => x.id === id);

    if(!t) return;

    editingTransactionId = id;

    document.querySelector(".nav-btn[data-tab='entry-tab']").click();

    document.getElementById("entry-year").value = t.year;

    document.getElementById("type-select").value = t.type;
    document.getElementById("type-select").dispatchEvent(new Event("change"));

    document.getElementById("month-select").value = t.month;

    document.getElementById("member-select").value = t.member ?? "";

    document.getElementById("amount-input").value = t.amount;

    document.getElementById("description-input").value = t.description;

    document.querySelector("#entry-form button[type='submit']").textContent="حفظ التعديل";

}
