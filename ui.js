        feather.replace();

        window.switchView = function(viewId) {
            const views = ['order-view', 'track-view', 'operator-login-view', 'operator-dashboard-view'];
            views.forEach(id => {
                const el = document.getElementById(id);
                if (el) { el.classList.add('hidden'); el.classList.remove('fade-in'); }
            });
            const target = document.getElementById(viewId);
            if (target) { target.classList.remove('hidden'); void target.offsetWidth; target.classList.add('fade-in'); }

            const navTabs = document.getElementById('nav-tabs');
            const navHome = document.getElementById('nav-home');
            const navOp = document.getElementById('nav-operator');
            
            if (viewId === 'operator-login-view') {
                navTabs.style.opacity = '0';
                navTabs.style.transform = 'translateX(20px)';
                navTabs.style.pointerEvents = 'none';
                
                navHome.style.opacity = '1';
                navHome.style.transform = 'translateX(0)';
                navHome.style.pointerEvents = 'auto';
                
                if (navOp) navOp.style.display = '';
            } else if (viewId === 'operator-dashboard-view') {
                navTabs.style.opacity = '0';
                navTabs.style.transform = 'translateX(20px)';
                navTabs.style.pointerEvents = 'none';
                
                navHome.style.opacity = '0';
                navHome.style.pointerEvents = 'none';
                
                if (navOp) navOp.style.display = 'none';
            } else {
                navTabs.style.opacity = '1';
                navTabs.style.transform = 'translateX(0)';
                navTabs.style.pointerEvents = 'auto';
                
                navHome.style.opacity = '0';
                navHome.style.transform = 'translateX(-20px)';
                navHome.style.pointerEvents = 'none';
                
                if (navOp) navOp.style.display = '';
            }

            if (viewId === 'order-view' || viewId === 'track-view') {
                document.getElementById('nav-order').classList.remove('nav-active');
                document.getElementById('nav-track').classList.remove('nav-active');
                const activeBtnId = viewId === 'order-view' ? 'nav-order' : 'nav-track';
                document.getElementById(activeBtnId).classList.add('nav-active');
            }
        }

        // Dropzone UI logic
        const fileInput = document.getElementById('fileInput');
        const fileList = document.getElementById('fileList');
        fileInput.addEventListener('change', async () => {
            if(fileInput.files.length === 0) {
                document.getElementById('pagesCount').value = 1;
                calculateTotal();
                return;
            }
            
            fileList.innerHTML = '<div class="text-sm text-pine-light animate-pulse"><i data-feather="loader" class="w-4 h-4 inline animate-spin"></i> Analyzing documents...</div>';
            fileList.classList.remove('hidden');
            if (typeof feather !== 'undefined') feather.replace();
            
            let totalAutoPages = 0;
            
            try {
                for (let f of Array.from(fileInput.files)) {
                    if (f.type === 'application/pdf') {
                        try {
                            const arrayBuffer = await f.arrayBuffer();
                            const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
                            totalAutoPages += pdfDoc.getPageCount();
                        } catch(e) {
                            console.error("Could not parse PDF:", f.name, e);
                            totalAutoPages += 1;
                        }
                    } else {
                        // Images or other assume 1 page
                        totalAutoPages += 1;
                    }
                }
                
                document.getElementById('pagesCount').value = totalAutoPages;
                calculateTotal();
                
                fileList.innerHTML = '';
                Array.from(fileInput.files).forEach(f => {
                    fileList.innerHTML += `<div class="p-2 border rounded-md text-sm mb-1 bg-white">${f.name}</div>`;
                });
            } catch (err) {
                console.error("Error reading files", err);
                fileList.innerHTML = '<div class="text-sm text-red-500">Error reading files.</div>';
            }
        });

        // Receipt UI logic
        const receiptInput = document.getElementById('receiptInput');
        receiptInput.addEventListener('change', (e) => {
            if(e.target.files.length > 0) {
                document.getElementById('receiptName').textContent = e.target.files[0].name;
            }
        });

        window.closeSuccessModal = function() {
            document.getElementById('successModal').classList.add('hidden');
            document.getElementById('trackId').value = document.getElementById('successPrintId').textContent;
            switchView('track-view');
        }

        window.dismissSuccessModal = function() {
            document.getElementById('successModal').classList.add('hidden');
        }

        window.copyPrintId = function() {
            const printId = document.getElementById('successPrintId').textContent;
            navigator.clipboard.writeText(printId).then(() => {
                const wrapper = document.getElementById('copyIconWrapper');
                const feedback = document.getElementById('copyFeedback');
                
                wrapper.innerHTML = '<i data-feather="check" class="w-5 h-5 text-coolgreen"></i>';
                if (typeof feather !== 'undefined') feather.replace();
                
                feedback.style.opacity = '1';
                
                setTimeout(() => {
                    wrapper.innerHTML = '<i data-feather="copy" class="w-5 h-5"></i>';
                    if (typeof feather !== 'undefined') feather.replace();
                    feedback.style.opacity = '0';
                }, 2000);
            }).catch(err => {
                console.error("Could not copy text: ", err);
            });
        }

        window.copyToClipboard = function(text, btnElement) {
            navigator.clipboard.writeText(text).then(() => {
                const originalHTML = btnElement.innerHTML;
                btnElement.innerHTML = '<i data-feather="check" class="w-3.5 h-3.5 text-coolgreen"></i>';
                if (typeof feather !== 'undefined') feather.replace();
                setTimeout(() => {
                    btnElement.innerHTML = originalHTML;
                    if (typeof feather !== 'undefined') feather.replace();
                }, 2000);
            }).catch(err => {
                console.error("Could not copy text: ", err);
            });
        }

        // Price calculation logic
        function calculateTotal() {
            const pages = parseInt(document.getElementById('pagesCount').value) || 1;
            const copies = parseInt(document.getElementById('copiesCount').value) || 1;
            const mode = document.getElementById('colorMode').value;
            const side = document.getElementById('sideOption').value;
            const compile = document.getElementById('compileOption').value;
            const binder = document.getElementById('binderOption').value;
            const coverpage = document.getElementById('coverpageOption').value;
            
            let pricePerSheet = 0;
            let sheets = pages;

            if (side === 'both') {
                pricePerSheet = mode === 'bw' ? 0.30 : 0.70;
                sheets = Math.ceil(pages / 2);
            } else {
                pricePerSheet = mode === 'bw' ? 0.20 : 0.50;
                sheets = pages;
            }
            
            let extraCostPerCopy = 0;
            if (compile === 'staple') extraCostPerCopy += 1.50;
            if (compile === 'linen') extraCostPerCopy += 1.00;
            if (compile === 'binder') {
                if (binder === 'plastic') extraCostPerCopy += 1.00;
                if (binder === 'ring') extraCostPerCopy += 2.50;
            }
            
            if (coverpage === 'transparent') extraCostPerCopy += 0.50;
            if (coverpage === 'translucent') extraCostPerCopy += 0.60;
            
            const total = (sheets * pricePerSheet + extraCostPerCopy) * copies;
            window.currentTotal = total;
            document.getElementById('priceDisplay').textContent = `RM ${total.toFixed(2)}`;
        }

        document.getElementById('pagesCount').addEventListener('input', calculateTotal);
        document.getElementById('copiesCount').addEventListener('input', calculateTotal);
        document.getElementById('colorMode').addEventListener('change', calculateTotal);
        document.getElementById('sideOption').addEventListener('change', calculateTotal);
        document.getElementById('coverpageOption').addEventListener('change', calculateTotal);
        
        document.getElementById('compileOption').addEventListener('change', (e) => {
            const binderContainer = document.getElementById('binderOptionContainer');
            if (e.target.value === 'binder') {
                binderContainer.classList.remove('hidden');
            } else {
                binderContainer.classList.add('hidden');
            }
            calculateTotal();
        });
        document.getElementById('binderOption').addEventListener('change', calculateTotal);
        
        // Initial calculation
        calculateTotal();
