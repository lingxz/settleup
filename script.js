// script.js
document.addEventListener('DOMContentLoaded', () => {
    const playersList = document.getElementById('players-list');
    const addPlayerBtn = document.getElementById('add-player-btn');
    const calculateBtn = document.getElementById('calculate-btn');
    const resultsSection = document.getElementById('results-section');
    const transactionsList = document.getElementById('transactions-list');
    const totalPoolEl = document.getElementById('total-pool');
    const balanceWarning = document.getElementById('balance-warning');
    const template = document.getElementById('player-row-template');
    const shareBtn = document.getElementById('share-btn');
    const shareTrackerBtn = document.getElementById('share-tracker-btn');
    const totalBuyinsEl = document.getElementById('total-buyins');
    const viewSettleBtn = document.getElementById('view-settle-btn');
    const viewTrackerBtn = document.getElementById('view-tracker-btn');

    // View toggling
    viewSettleBtn.addEventListener('click', () => {
        document.body.className = 'view-settle';
        viewSettleBtn.classList.add('active');
        viewTrackerBtn.classList.remove('active');
    });

    viewTrackerBtn.addEventListener('click', () => {
        document.body.className = 'view-tracker';
        viewTrackerBtn.classList.add('active');
        viewSettleBtn.classList.remove('active');
    });

    // Parse URL for state
    const urlParams = new URLSearchParams(window.location.search);
    const stateKey = urlParams.get('state');
    let loadedState = false;

    if (stateKey) {
        try {
            let parsedPlayers = [];
            
            if (stateKey.includes('~')) {
                // New compact format: name~amount~buyins_name2~amount2~buyins2
                parsedPlayers = stateKey.split('_').map(pStr => {
                    const parts = pStr.split('~');
                    return {
                        name: decodeURIComponent(parts[0]),
                        amount: parts[1] === '' ? '' : parseFloat(parts[1]),
                        buyins: parseInt(parts[2], 10) || 0
                    };
                });
            } else {
                // Legacy base64 JSON format
                const decoded = JSON.parse(decodeURIComponent(atob(stateKey)));
                if (Array.isArray(decoded)) {
                    parsedPlayers = decoded;
                }
            }

            if (parsedPlayers.length > 0) {
                parsedPlayers.forEach(p => addPlayerRow(p.name, p.amount, p.buyins));
                loadedState = true;
                updateTotal();
                
                if (urlParams.get('view') === 'tracker') {
                    document.body.className = 'view-tracker';
                    viewTrackerBtn.classList.add('active');
                    viewSettleBtn.classList.remove('active');
                } else if (urlParams.get('calc') === 'true') {
                    setTimeout(() => handleCalculate(), 0);
                }
            }
        } catch (e) {
            console.error('Failed to parse URL state', e);
        }
    }

    if (!loadedState) {
        // Add initial few players
        addPlayerRow();
        addPlayerRow();
        addPlayerRow();
    }

    addPlayerBtn.addEventListener('click', () => addPlayerRow());
    calculateBtn.addEventListener('click', handleCalculate);

    function addPlayerRow(name = '', amount = '', buyins = 0) {
        const clone = template.content.cloneNode(true);
        const row = clone.querySelector('.player-row');
        
        const removeBtn = row.querySelector('.remove-player-btn');
        removeBtn.addEventListener('click', () => {
            row.remove();
            updateTotal();
        });

        const amountInput = row.querySelector('.player-amount');
        amountInput.addEventListener('input', updateTotal);
        if (amount !== '') amountInput.value = amount;

        const nameInput = row.querySelector('.player-name');
        if (name) nameInput.value = name;

        // Buy-in counter logic
        const decBtn = row.querySelector('.decrement');
        const incBtn = row.querySelector('.increment');
        const countInput = row.querySelector('.buyin-count');
        
        countInput.value = buyins || 0;

        countInput.addEventListener('input', () => {
            let val = parseInt(countInput.value, 10);
            if (isNaN(val) || val < 0) {
                countInput.value = 0;
            }
            updateTotal();
        });

        decBtn.addEventListener('click', () => {
            let current = parseInt(countInput.value, 10) || 0;
            if (current > 0) {
                countInput.value = current - 1;
                updateTotal();
            }
        });

        incBtn.addEventListener('click', () => {
            let current = parseInt(countInput.value, 10) || 0;
            countInput.value = current + 1;
            updateTotal();
        });

        playersList.appendChild(clone);
    }

    function updateTotal() {
        const amountInputs = document.querySelectorAll('.player-amount');
        let total = 0;
        
        amountInputs.forEach(input => {
            const val = parseFloat(input.value);
            if (!isNaN(val)) {
                total += val;
            }
        });

        totalPoolEl.textContent = `$${Math.abs(total).toFixed(2)}`;
        
        // In poker, the sum of all up and down MUST be 0.
        // E.g. Player A +50, Player B -50.
        // But what if people just put their absolute stack sizes?
        // Usually, settling debts expects the net to be zero.
        // Let's assume positive means winnings, negative means losses.
        if (Math.abs(total) > 0.01 && document.querySelectorAll('.player-row').length > 0) {
            totalPoolEl.style.color = 'var(--danger)';
            balanceWarning.classList.remove('hidden');
        } else {
            totalPoolEl.style.color = 'var(--text-primary)';
            balanceWarning.classList.add('hidden');
        }

        // Update total buy-ins
        const countInputs = document.querySelectorAll('.buyin-count');
        let totalBuyins = 0;
        countInputs.forEach(input => {
            totalBuyins += parseInt(input.value, 10) || 0;
        });
        if (totalBuyinsEl) {
            totalBuyinsEl.textContent = totalBuyins;
        }
    }

    function handleCalculate() {
        const rows = document.querySelectorAll('.player-row');
        const balances = [];
        let sum = 0;

        // Parse inputs
        for (let i = 0; i < rows.length; i++) {
            const nameInput = rows[i].querySelector('.player-name').value.trim();
            const amountInput = parseFloat(rows[i].querySelector('.player-amount').value);
            
            const amount = isNaN(amountInput) ? 0 : amountInput;

            const name = nameInput || `Player ${i + 1}`;
            
            if (amount !== 0) {
                balances.push({ name, amount });
                sum += amount;
            }
        }

        // Disambiguate duplicate names by appending their initially owed/won amount
        const nameCounts = {};
        balances.forEach(b => {
            nameCounts[b.name] = (nameCounts[b.name] || 0) + 1;
        });

        balances.forEach(b => {
            if (nameCounts[b.name] > 1) {
                const sign = b.amount > 0 ? '+' : '-';
                b.name = `${b.name} (${sign}$${Math.abs(b.amount).toFixed(2)})`;
            }
        });

        // Proceed with calculation even if there's an imbalance (sum != 0)
        // The warning is already shown on the UI.

        const transactions = calculateDebts(balances);
        renderTransactions(transactions);
    }

    function calculateDebts(balances) {
        const debtors = [];
        const creditors = [];

        // Separate into debtors (negative) and creditors (positive)
        balances.forEach(b => {
            if (b.amount < -0.001) debtors.push({ name: b.name, amount: -b.amount }); // Store amount as positive magnitude
            else if (b.amount > 0.001) creditors.push({ name: b.name, amount: b.amount });
        });

        const transactions = [];

        // Greedy matching
        let i = 0; // index for debtors
        let j = 0; // index for creditors

        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];
            
            const settleAmount = Math.min(debtor.amount, creditor.amount);
            
            // Avoid floating point inaccuracies creating zero transactions
            if (settleAmount > 0.001) {
                transactions.push({
                    from: debtor.name,
                    to: creditor.name,
                    amount: settleAmount
                });
            }

            // Reduce remaining balances
            debtor.amount -= settleAmount;
            creditor.amount -= settleAmount;

            // Move pointer if balance settled
            if (debtor.amount < 0.001) i++;
            if (creditor.amount < 0.001) j++;
        }

        return transactions;
    }

    function renderTransactions(transactions) {
        transactionsList.innerHTML = '';
        resultsSection.classList.remove('hidden');

        if (transactions.length === 0) {
            transactionsList.innerHTML = `
                <div class="all-settled">
                    Everyone is already settled up!
                </div>
            `;
            return;
        }

        transactions.forEach(tx => {
            const div = document.createElement('div');
            div.className = 'transaction-card';
            div.innerHTML = `
                <div class="tx-details">
                    <span class="tx-from">${escapeHTML(tx.from)}</span>
                    <span class="arrow">pays</span>
                    <span class="tx-to">${escapeHTML(tx.to)}</span>
                </div>
                <div class="tx-amount">$${tx.amount.toFixed(2)}</div>
            `;
            transactionsList.appendChild(div);
        });
        
        // Scroll to results smoothly
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    // basic XSS prevention for user input injected as HTML
    function escapeHTML(str) {
        const p = document.createElement('p');
        p.appendChild(document.createTextNode(str));
        return p.innerHTML;
    }

    if (shareTrackerBtn) {
        shareTrackerBtn.addEventListener('click', () => handleShare(shareTrackerBtn, false));
    }

    if (shareBtn) {
        shareBtn.addEventListener('click', () => handleShare(shareBtn, true));
    }

    function handleShare(btn, autoCalc = false) {
        let shareUrl = window.location.href.split('?')[0];
        const rows = document.querySelectorAll('.player-row');
        const serializedPlayers = [];
        
        for (let i = 0; i < rows.length; i++) {
            const nameInput = rows[i].querySelector('.player-name').value.trim();
            const amountInput = parseFloat(rows[i].querySelector('.player-amount').value);
            const amount = isNaN(amountInput) ? '' : amountInput;
            const buyins = parseInt(rows[i].querySelector('.buyin-count').value, 10) || 0;
            
            if (nameInput || amount !== '' || buyins !== 0) {
                serializedPlayers.push(`${encodeURIComponent(nameInput)}~${amount}~${buyins}`);
            }
        }
        
        if (serializedPlayers.length > 0) {
            const stateStr = serializedPlayers.join('_');
            const newUrl = new URL(shareUrl);
            newUrl.searchParams.set('state', stateStr);
            if (autoCalc) {
                newUrl.searchParams.set('calc', 'true');
            }
            if (document.body.classList.contains('view-tracker')) {
                newUrl.searchParams.set('view', 'tracker');
            }
            shareUrl = newUrl.href;
        }

        navigator.clipboard.writeText(shareUrl).then(() => {
            const isIconBtn = btn.classList.contains('icon-button');
            const originalText = btn.innerHTML;
            
            if (isIconBtn) {
                const originalTitle = btn.title;
                btn.title = "Copied!";
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>`;
                btn.style.color = 'var(--success)';
                
                setTimeout(() => {
                    btn.title = originalTitle;
                    btn.innerHTML = originalText;
                    btn.style.color = '';
                }, 2000);
            } else {
                const originalTextContent = btn.textContent;
                btn.textContent = "Link Copied!";
                btn.style.backgroundColor = 'var(--success)';
                
                setTimeout(() => {
                    btn.textContent = originalTextContent;
                    btn.style.backgroundColor = '';
                }, 2000);
            }
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    }
});
