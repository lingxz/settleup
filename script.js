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

    // Add initial few players
    addPlayerRow();
    addPlayerRow();
    addPlayerRow();

    addPlayerBtn.addEventListener('click', addPlayerRow);
    calculateBtn.addEventListener('click', handleCalculate);

    function addPlayerRow() {
        const clone = template.content.cloneNode(true);
        const row = clone.querySelector('.player-row');
        
        const removeBtn = row.querySelector('.remove-player-btn');
        removeBtn.addEventListener('click', () => {
            row.remove();
            updateTotal();
        });

        const amountInput = row.querySelector('.player-amount');
        amountInput.addEventListener('input', updateTotal);

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
    }

    function handleCalculate() {
        const rows = document.querySelectorAll('.player-row');
        const balances = [];
        let sum = 0;

        // Parse inputs
        for (let i = 0; i < rows.length; i++) {
            const nameInput = rows[i].querySelector('.player-name').value.trim();
            const amountInput = parseFloat(rows[i].querySelector('.player-amount').value);
            
            const name = nameInput || `Player ${i + 1}`;
            const amount = isNaN(amountInput) ? 0 : amountInput;
            
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

        // Validate sum is close to zero (floating point)
        if (Math.abs(sum) > 0.01) {
            alert(`The total balances do not sum to zero (Off by $${sum.toFixed(2)}). Please ensure total winnings equal total losses.`);
            return;
        }

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
});
