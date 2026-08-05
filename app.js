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
// 2. GOOGLE API & AUTHENTICATION CONFIG
// ==========================================
const CLIENT_ID = '451645880185-tsp7hs1s6cq66l6qlf4h9d8l33emmme4.apps.googleusercontent.com'; // Replace with your Client ID
const API_KEY = 'AIzaSyA54V4M6pE1_ST_e8gTPu-sE9Vy70ChNhc';     // Replace with your API Key
const DISCOVERY_DOCS = [
    'https://sheets.googleapis.com/$discovery/rest?version=v4',
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
];
const SCOPES =
'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let authReady = false;
let isSigningIn = false;
let documentSpreadsheetId = null;

let appData = { transactions: [], members: [], years: [DEFAULT_YEAR] };

window.gapiLoaded = function () {

    gapi.load("client", initializeGapiClient);

};

async function initializeGapiClient() {

    await gapi.client.init({

        apiKey: API_KEY,

        discoveryDocs: DISCOVERY_DOCS

    });

    gapiInited = true;

    checkEnableLogin();

}

window.gisLoaded = function () {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (resp) => {

            if (resp.error) throw resp;

            localStorage.setItem(
                "google_last_login",
                Date.now()
            );

            document.getElementById("login-overlay").style.display = "none";

            await loadAppFromGoogle();

        },
    });

    gisInited = true;

    checkEnableLogin();

    
}

function checkEnableLogin() {

    if (!(gapiInited && gisInited))
        return;

    authReady = true;

    const btn = document.getElementById("google-login-btn");

    btn.disabled = false;

    btn.innerText = "Google";

    const lastLogin = Number(

        localStorage.getItem("google_last_login") || 0

    );

    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    if (

        Date.now() - lastLogin < sevenDays

    ) {

        handleAuthClick();

    }

}

async function handleAuthClick() {

    if (!authReady)
        return;

    if (!tokenClient)
        return;

    if (isSigningIn)
        return;

    isSigningIn = true;

    try{

        tokenClient.requestAccessToken({

            prompt:""

        });

    }finally{

        setTimeout(()=>{

            isSigningIn=false;

        },1500);

    }

}

async function loadAppFromGoogle() {

    while (
        !gapi.client ||
        !gapi.client.drive ||
        !gapi.client.sheets
    ) {

        await new Promise(resolve => setTimeout(resolve, 250));

    }

    let response;

    try {

        response = await gapi.client.drive.files.list({

            q: "name='جمعية ال دواس' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",

            spaces: "drive"

        });

    } catch (err) {

        console.error(err);

        return;

    }

    const files = response.result.files;

    if (files && files.length > 0) {

        documentSpreadsheetId = files[0].id;

        await fetchGoogleSheetData();

    } else {

        await createGoogleSheet();

    }

    initYearSelector();

    currentYear = DEFAULT_YEAR;

    document.getElementById("year-select").value = DEFAULT_YEAR;
    document.getElementById("report-year-select").value = DEFAULT_YEAR;
    document.getElementById("entry-year").value = DEFAULT_YEAR;

    renderMemberDropdown();

    renderActiveTab();

}

async function createGoogleSheet() {

    const sheetBody = {
        properties: {
            title: "جمعية ال دواس"
        },
        sheets: [
            {properties:{title:"الدخل"}},
            {properties:{title:"المصروفات و اخرى"}},
            {properties:{title:"الاعضاء"}},
            {properties:{title:"السنوات"}}
        ]
    };

    const response =
    await gapi.client.sheets.spreadsheets.create({}, sheetBody);

    documentSpreadsheetId =
    response.result.spreadsheetId;

    await syncToGoogleSheets();

}

async function fetchGoogleSheetData() {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.batchGet({
            spreadsheetId: documentSpreadsheetId,
            ranges: ['الدخل!A:F', 'المصروفات و اخرى!A:G', 'الاعضاء!A:B', 'السنوات!A:A']
        });
        
        const ranges = response.result.valueRanges;
        appData.transactions = [];
        
        if (ranges[0].values) {
            ranges[0].values.forEach(row => {
                if(row[0] === "ID") return;
                appData.transactions.push({
    id:Number(row[0]),
    year:Number(row[1]),
    month:row[2],
    type:"الجمعية",
    member:Number(row[3]),
    amount:Number(row[4]),
    description:row[5]||""
});
            });
        }
        
        if (ranges[1].values) {
            ranges[1].values.forEach(row => {
                if(row[0] === "ID") return;
                appData.transactions.push({ id: Number(row[0]), year: Number(row[1]), month: row[2], type: row[3], member: row[4] ? Number(row[4]) : null, amount: Number(row[5]), description: row[6] || "" });
            });
        }
        
        appData.members = [];
        if (ranges[2].values) {
            ranges[2].values.forEach(row => {
                if(row[0] === "ID") return;
                appData.members.push({ id: Number(row[0]), name: row[1] });
            });
        }
        
        appData.years = [];
        if (ranges[3].values) {
            ranges[3].values.forEach(row => {
                if(row[0] === "Year") return;
                appData.years.push(Number(row[0]));
            });
        }
        if(appData.years.length === 0) appData.years.push(DEFAULT_YEAR);
        
    } catch (err) { console.error("Data Fetch Error:", err); }
}

async function syncToGoogleSheets() {
    if (!documentSpreadsheetId) return;
    
    const incomeData = [["ID", "Year", "Month", "Member", "Amount", "Description"]];
    const expenseData = [["ID", "Year", "Month", "Type", "Member", "Amount", "Description"]];
    
    appData.transactions.forEach(t => {
        if (t.type === "الجمعية") incomeData.push([t.id, t.year, t.month, t.member, t.amount, t.description]);
        else expenseData.push([t.id, t.year, t.month, t.type, t.member || "", t.amount, t.description]);
    });
    
    const membersData = [["ID", "Name"]];
    appData.members.forEach(m => membersData.push([m.id, m.name]));
    
    const yearsData = [["Year"]];
    appData.years.forEach(y => yearsData.push([y]));
    
    const data = [
        { range: 'الدخل!A:F', values: incomeData },
        { range: 'المصروفات و اخرى!A:G', values: expenseData },
        { range: 'الاعضاء!A:B', values: membersData },
        { range: 'السنوات!A:A', values: yearsData }
    ];
    
    try {
        await gapi.client.sheets.spreadsheets.values.batchClear({
            spreadsheetId: documentSpreadsheetId,
            ranges: ['الدخل!A:G', 'المصروفات و اخرى!A:G', 'الاعضاء!A:B', 'السنوات!A:A']
        });
        await gapi.client.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: documentSpreadsheetId,
            resource: { data: data, valueInputOption: 'RAW' }
        });
    } catch (err) { console.error("Sync Error:", err); }
}

// ==========================================
// 3. DATA STORAGE WRAPPERS (In-Memory & Sheets Sync)
// ==========================================
function loadTransactions() { return appData.transactions; }
async function saveTransaction(transaction) {

    appData.transactions.push(transaction);

    await syncToGoogleSheets();

}
function loadMembers() { return appData.members; }
async function saveMember(member) {

    appData.members.push(member);

    await syncToGoogleSheets();

}
function loadYears() { return appData.years; }
async function saveYear(year){

    if(appData.years.includes(year))
        return;

    appData.years.push(year);

    appData.years.sort((a,b)=>b-a);

    await syncToGoogleSheets();

}

// ==========================================
// 4. APP STATE & INITIALIZATION
// ==========================================
let currentYear = DEFAULT_YEAR;
let editingTransactionId = null;

let editingMonthTransactionId = null;
let editingDescriptionTransactionId = null;

document.addEventListener("DOMContentLoaded", () => {

    // Always show the current year immediately
    appData.years = [DEFAULT_YEAR];

    initYearSelector();
    initMonthSelector();
    renderMemberDropdown();
    initEventListeners();

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

    years.push(DEFAULT_YEAR);

    years.sort((a,b)=>b-a);

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
    document
    .getElementById("save-payment-btn")
    .addEventListener("click",saveMonthPayment);
    
    // Form Submit
document
    .getElementById("entry-form")
    .addEventListener("submit", handleFormSubmit);

// Save Amount
document
    .getElementById("save-payment-btn")
    .addEventListener("click", saveMonthPayment);

// Cancel Amount
document
    .getElementById("cancel-payment-btn")
    .addEventListener("click", () => {

        document
            .getElementById("edit-payment-modal")
            .classList.add("hidden");

    });

// Save Description
document
    .getElementById("save-description-btn")
    .addEventListener("click", saveDescription);

// Cancel Description
document
    .getElementById("cancel-description-btn")
    .addEventListener("click", () => {

        document
            .getElementById("edit-description-modal")
            .classList.add("hidden");

    });

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

async function handleAddMember() {
    const input = document.getElementById("new-member-name");
    const name = input.value.trim();
    
    if (!name) {
        alert("يرجى إدخال اسم العضو.");
        return;
    }

    const members = loadMembers();
    const newId = members.length > 0 ? Math.max(...members.map(m => m.id)) + 1 : 1;
    const newMember = { id: newId, name: name };

    await saveMember(newMember);
    renderMemberDropdown();
    
    document.getElementById("member-select").value = newId;
    closeMemberModal();
}

// ==========================================
// 8. FORM SUBMISSION HANDLER
// ==========================================
async function handleFormSubmit(e){
    e.preventDefault();

    const entryYear = parseInt(document.getElementById("entry-year").value, 10);
    const type = document.getElementById("type-select").value;
    const month = document.getElementById("month-select").value;
const memberVal = document.getElementById("member-select").value;

const amount = parseFloat(
    normalizeNumber(
        document.getElementById("amount-input").value
    )
);

const description = document.getElementById("description-input").value.trim();

if (type === "الجمعية" && (!memberVal || memberVal === "ADD_NEW")) {
        showAlert("يرجى اختيار عضو.", "danger");
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

    await syncToGoogleSheets();

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
        money(getOpeningBalance(currentYear));
    
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
    headerHTML += `<th class="month-header-cell">اجمالي الشهر</th>`;
    headerRow.innerHTML = headerHTML;

    // Filter Association Transactions for current year
    const assocTxns = transactions.filter(t => t.type === "الجمعية");
    const monthTotals = {};

ARABIC_MONTHS.forEach(m => monthTotals[m] = 0);

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
                monthTotals[month] += monthSum;
        
                cellsHTML += `
                    <td
                        class="paid-cell payment-cell"
                        data-id="${txns[0].id}"
                    >
                        ${money(monthSum)}
                    </td>
                `;
        
            } else {
        
                const isFutureMonth =
                    currentYear === CURRENT_DATE.getFullYear() &&
                    index > CURRENT_DATE.getMonth();
        
                if (isFutureMonth) {
        
                    cellsHTML += `<td>-</td>`;
        
                } else {
        
                    cellsHTML += `<td class="unpaid-cell">-</td>`;
        
                }
        
            }
        
        });
        
        
        /* ---------- calculate badge from ALL years ---------- */
        
        const years = loadYears();
        
        years.forEach(year => {

    ARABIC_MONTHS.forEach((month,index)=>{

        // don't count future years
        if(year > CURRENT_DATE.getFullYear())
            return;

        // don't count future months of the current real year
        if(
            year === CURRENT_DATE.getFullYear() &&
            index > CURRENT_DATE.getMonth()
        )
            return;

        // if user is viewing a future year don't count anything
        if(year > currentYear)
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
                    <span
                    style="cursor:pointer"
                    onclick="showMissingMonths(${member.id})"
                    >
                    ${member.name}
                    </span>
                    ${unpaidCount > 0 ? `<span class="unpaid-badge" title="${unpaidCount} أشهر غير مدفوعة">${unpaidCount}</span>` : ''}
                </div>
            </td>
            
            ${cellsHTML}
            <td><strong>${money(totalBalance)}</strong></td>
        `;
        tbody.appendChild(tr);
        tr.querySelectorAll(".payment-cell").forEach(cell=>{

    cell.addEventListener("dblclick",function(){

        editingMonthTransactionId=

        Number(this.dataset.id);

        document
        .getElementById("edit-payment-input")
        .value=this.innerText;

               document
        .getElementById("edit-payment-modal")
        .classList.remove("hidden");

    });

});
    });

    const totalRow = document.createElement("tr");

    let html = `<td colspan="2"><b>اجمالي العضو</b></td>`;

    ARABIC_MONTHS.forEach(month => {
        html += `<td><b>${money(monthTotals[month])}</b></td>`;
    });

    html += `<td><b>${
        money(
            Object.values(monthTotals).reduce((a,b)=>a+b,0)
        )
    }</b></td>`;

    totalRow.innerHTML = html;
    totalRow.style.background = "#eef6ff";
    totalRow.style.fontWeight = "bold";

    tbody.appendChild(totalRow);
}

function renderStandardTable(type, tbodyId, totalId, transactions, members) {
    const tbody = document.getElementById(tbodyId);
    const totalElem = document.getElementById(totalId);

    const filteredTxns = transactions.filter(t => t.type === type);
tbody.innerHTML = "";

let total = 0;

const monthTotals = {};

ARABIC_MONTHS.forEach(m => monthTotals[m] = 0);

if (filteredTxns.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">لا توجد عمليات مسجلة.</td></tr>`;
        totalElem.textContent = money(0);
        return;
    }

    filteredTxns.forEach(t => {
        total+=t.amount;
        monthTotals[t.month]+=t.amount;
        const memberObj = members.find(m => m.id === t.member);
        const memberName = memberObj ? memberObj.name : "-";

                const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${t.month}</td>

            <td
    class="description-cell"
    data-id="${t.id}"
>

    ${
        t.description
        ?
        (
            t.description.length > 35
            ?
            `
            ${t.description.substring(0,35)}...

            <br>

            <span
                class="more-link"
                onclick="event.stopPropagation();showDescription(${JSON.stringify(t.description)})"
            >
                المزيد
            </span>
            `
            :
            t.description
        )
        :
        "-"
    }

</td>

            <td>${memberName}</td>

            <td
                class="payment-cell"
                data-id="${t.id}"
            >
                ${money(t.amount)}
            </td>

            <td>
                <button
                    type="button"
                    class="delete-btn"
                    data-id="${t.id}">
                    🗑
                </button>
            </td>
        `;

        tbody.appendChild(tr);
        

                tr.querySelector(".delete-btn").addEventListener("click", function(e){

            e.stopPropagation();

            deleteTransaction(
                Number(this.dataset.id)
            );

        });

        tr.querySelector(".payment-cell").addEventListener("dblclick", function(){

            editingMonthTransactionId = Number(this.dataset.id);

            document
            .getElementById("edit-payment-input")
            .value = this.innerText.replace(/,/g,"");

            document
            .getElementById("edit-payment-modal")
            .classList.remove("hidden");

        });

        tr.querySelector(".description-cell").addEventListener("dblclick", function(){

            editDescription(
                Number(this.dataset.id)
            );

        });

    });

    totalElem.textContent=money(total);
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

    document.getElementById("total-income-val").textContent = money(totalIncome);
    document.getElementById("total-expenses-val").textContent = money(totalExpenses);
    document.getElementById("total-others-val").textContent = money(totalOthers);
    document.getElementById("total-savings-val").textContent = money(savings);

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
            <td>${money(mIncome)}</td>
            <td>${money(mExpenses)}</td>
            <td>${money(mOthers)}</td>
            <td style="font-weight: bold; color: ${mNet >= 0 ? '#2e7d32' : '#c62828'};">
                ${money(mNet)}
            </td>
        `;
        tbody.appendChild(tr);
    });
}
async function deleteTransaction(id){

    if(!confirm("حذف العملية؟"))
        return;

    appData.transactions = appData.transactions.filter(t=>t.id!==id);

    await syncToGoogleSheets();

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
async function saveMonthPayment(){

    const amount = parseFloat(

        normalizeNumber(

            document
            .getElementById("edit-payment-input")
            .value

        )

    );

    if(isNaN(amount))
        return;

    const data=loadTransactions();

    const t=data.find(x=>

        x.id===editingMonthTransactionId

    );

    if(!t) return;

    t.amount=amount;

    await syncToGoogleSheets();

    document

    .getElementById("edit-payment-modal")

    .classList.add("hidden");

    renderActiveTab();

}

function editDescription(id){

    const data = loadTransactions();

    const t = data.find(x => x.id === id);

    if(!t) return;

    editingDescriptionTransactionId = id;

    document
        .getElementById("edit-description-input")
        .value = t.description || "";

    document
        .getElementById("edit-description-modal")
        .classList.remove("hidden");

}


async function saveDescription(){

    const data=loadTransactions();

    const t=data.find(x=>

        x.id===editingDescriptionTransactionId

    );

    if(!t) return;

    t.description=

        document

        .getElementById("edit-description-input")

        .value;

    await syncToGoogleSheets();

    document

    .getElementById("edit-description-modal")

    .classList.add("hidden");

    renderActiveTab();

}

function normalizeNumber(value){

    return String(value)

        .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))

        .replace(/[^\d.]/g, "");

}

function money(v){

    return Number(v || 0).toLocaleString("en-US",{

        maximumFractionDigits:0

    });

}
function showMissingMonths(memberId){

    const years=loadYears();
    const all=loadTransactions();

    let text="";

    years.sort((a,b)=>a-b);

    years.forEach(year=>{

        let missing=[];

        ARABIC_MONTHS.forEach((month,index)=>{

    if(year > CURRENT_DATE.getFullYear())
        return;

    if(
        year === CURRENT_DATE.getFullYear() &&
        index > CURRENT_DATE.getMonth()
    )
        return;

    if(year > currentYear)
        return;

            const paid=all.some(t=>

                t.type==="الجمعية" &&
                t.member===memberId &&
                t.year===year &&
                t.month===month

            );

            if(!paid)
                missing.push(month);

        });

        if(missing.length){

            text+=year+"\\n";
            text+=missing.join(" ، ");
            text+="\\n\\n";

        }

    });

    if(text==="")
        text="لا يوجد أشهر غير مدفوعة";

    alert(text);

}
function showDescription(text){

    alert(text || "لا يوجد وصف");

}
