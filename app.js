        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
        import { getFirestore, collection, addDoc, getDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, where, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
        import { firebaseConfig, SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

        // ==========================================
        // 1. CONFIGURATION
        // Keys now live in config.js (kept out of git, see .gitignore)
        // ==========================================
        let app, auth, db, supabaseClient;
        
        try {
            app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } catch (err) {
            console.error("Firebase/Supabase Initialization Error: ", err);
            alert("Database Error: Check console.");
        }

        // Load QR Code from Supabase
        async function loadQrCode() {
            try {
                const { data, error } = await supabaseClient.storage.from('seprint-files').list('qrcode', { limit: 5 });
                let fileName = 'qrcode.png'; // default fallback
                if (data && !error) {
                    const validFile = data.find(f => f.name.match(/\.(png|jpg|jpeg|svg)$/i));
                    if (validFile) fileName = validFile.name;
                }
                const { data: urlData } = supabaseClient.storage.from('seprint-files').getPublicUrl('qrcode/' + fileName);
                
                const img = document.getElementById('qrCodeImage');
                if (img) {
                    img.src = urlData.publicUrl;
                    img.onload = () => {
                        img.classList.remove('hidden');
                        const placeholder = document.getElementById('qrCodePlaceholder');
                        if (placeholder) placeholder.classList.add('hidden');
                    };
                }
            } catch (e) {
                console.log("Could not load QR code dynamically.", e);
            }
        }
        
        loadQrCode();

        // ==========================================
        // 1.5 OPERATOR AVAILABILITY
        // ==========================================
        const statusDocRef = doc(db, 'orders', 'operator_status');
        
        onSnapshot(statusDocRef, (docSnap) => {
            const indicator = document.getElementById('customerAvailabilityIndicator');
            const text = document.getElementById('customerAvailabilityText');
            const statusContainer = document.getElementById('customerAvailabilityStatus');
            const opSwitch = document.getElementById('operatorStatusSwitch');
            const opLabel = document.getElementById('operatorStatusLabel');

            if (docSnap.exists()) {
                const isOnline = docSnap.data().isOnline;
                window.isOperatorOnline = isOnline;
                
                if (statusContainer) {
                    if (isOnline) {
                        statusContainer.className = "inline-flex items-center gap-2 px-4 py-2 rounded-full bg-mint text-pine font-medium text-sm transition-colors mt-2";
                        indicator.className = "w-2.5 h-2.5 rounded-full bg-coolgreen animate-pulse";
                        text.textContent = "Operator Online - Ready for Orders";
                    } else {
                        statusContainer.className = "inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-600 font-medium text-sm transition-colors mt-2";
                        indicator.className = "w-2.5 h-2.5 rounded-full bg-gray-400";
                        text.textContent = "Operator Offline - Order will take a time";
                    }
                }

                if (opSwitch) {
                    opSwitch.checked = isOnline;
                    if (opLabel) {
                        opLabel.textContent = isOnline ? "Online" : "Offline";
                        opLabel.className = isOnline ? "ml-3 text-sm font-medium text-coolgreen" : "ml-3 text-sm font-medium text-gray-500";
                    }
                }
            } else {
                setDoc(statusDocRef, { isOnline: false }, { merge: true }).catch(console.error);
            }
        });

        document.addEventListener('change', async (e) => {
            if(e.target.id === 'operatorStatusSwitch') {
                const isOnline = e.target.checked;
                try {
                    await setDoc(statusDocRef, { isOnline: isOnline }, { merge: true });
                } catch (err) {
                    console.error("Error updating operator status:", err);
                    e.target.checked = !isOnline;
                    alert("Failed to update status. Check permissions.");
                }
            }
        });

        // ==========================================
        // 2. CUSTOMER SUBMISSION
        // ==========================================
        document.getElementById('preSubmitBtn').addEventListener('click', () => {
            const phone = document.getElementById('phone').value;
            const name = document.getElementById('fullName').value;
            if(!phone || !name) return alert("Please enter your Name and Phone Number.");
            if(!document.getElementById('fileInput').files.length) return alert("Upload at least one document.");
            if(!document.getElementById('receiptInput').files.length) return alert("Please upload a payment receipt.");
            
            if (window.isOperatorOnline === false) {
                document.getElementById('offlineWarningModal').classList.remove('hidden');
                if (typeof feather !== 'undefined') feather.replace();
            } else {
                window.submitOrder();
            }
        });

        window.submitOrder = async () => {
            const phone = document.getElementById('phone').value;
            const name = document.getElementById('fullName').value;
            
            const btn = document.getElementById('preSubmitBtn');
            const originalContent = btn.innerHTML;
            btn.innerHTML = `<span>Uploading...</span><i data-feather="loader" class="w-5 h-5 animate-spin-slow"></i>`;
            if (typeof feather !== 'undefined') feather.replace();
            btn.disabled = true;

            try {
                // 1. Upload Files to Supabase Storage
                const files = document.getElementById('fileInput').files;
                const fileUrls = [];
                
                for(let file of files) {
                    const filePath = `documents/${Date.now()}_${file.name}`;
                    const { data, error } = await supabaseClient.storage.from('seprint-files').upload(filePath, file);
                    if (error) throw error;
                    fileUrls.push(filePath); 
                }

                // Upload Receipt
                let receiptUrl = "";
                const receiptFile = document.getElementById('receiptInput').files[0];
                if(receiptFile) {
                    const rPath = `receipts/${Date.now()}_${receiptFile.name}`;
                    const { data, error } = await supabaseClient.storage.from('seprint-files').upload(rPath, receiptFile);
                    if (error) throw error;
                    receiptUrl = rPath;
                }

                // 2. Save Order to Firestore
                const orderData = {
                    customerName: name,
                    customerPhone: phone,
                    uid: 'guest',
                    files: fileUrls,
                    receipt: receiptUrl,
                    status: 'pending', 
                    createdAt: new Date(),
                    copies: document.getElementById('copiesCount').value,
                    totalPages: document.getElementById('pagesCount').value,
                    colorMode: document.getElementById('colorMode').value,
                    sideOption: document.getElementById('sideOption').value,
                    compileOption: document.getElementById('compileOption').value,
                    binderOption: document.getElementById('compileOption').value === 'binder' ? document.getElementById('binderOption').value : null,
                    coverpageOption: document.getElementById('coverpageOption').value,
                    totalPrice: window.currentTotal || 0
                };

                const docRef = await addDoc(collection(db, "orders"), orderData);
                const printId = docRef.id;

                // 3. Show Success
                document.getElementById('successPrintId').textContent = printId;
                document.getElementById('successModal').classList.remove('hidden');

                // 4. Reset form (except name and phone)
                document.getElementById('fileInput').value = '';
                document.getElementById('fileList').innerHTML = '';
                document.getElementById('fileList').classList.add('hidden');
                
                document.getElementById('receiptInput').value = '';
                document.getElementById('receiptName').textContent = 'Choose receipt image/pdf...';
                
                document.getElementById('pagesCount').value = 1;
                document.getElementById('copiesCount').value = 1;
                document.getElementById('colorMode').value = 'bw';
                document.getElementById('sideOption').value = 'one';
                document.getElementById('compileOption').value = 'none';
                const binderContainer = document.getElementById('binderOptionContainer');
                if(binderContainer) binderContainer.classList.add('hidden');
                document.getElementById('coverpageOption').value = 'none';
                
                if (typeof calculateTotal === 'function') calculateTotal();

            } catch (e) {
                console.error("Upload/Save Error:", e);
                alert("Upload failed. Check console for details.");
            } finally {
                btn.innerHTML = originalContent;
                btn.disabled = false;
                feather.replace();
            }
        };

        // ==========================================
        // 3. OPERATOR AUTHENTICATION (EMAIL/PASS)
        // ==========================================
        document.getElementById('opLoginBtn').addEventListener('click', async () => {
            const email = document.getElementById('opEmail').value;
            const pass = document.getElementById('opPassword').value;
            try {
                await signInWithEmailAndPassword(auth, email, pass);
                
                window.switchView('operator-dashboard-view');
                loadOperatorOrders();
            } catch (e) {
                console.error(e);
                document.getElementById('opLoginError').textContent = "Invalid Credentials. Ensure operator user exists.";
                document.getElementById('opLoginError').classList.remove('hidden');
            }
        });

        document.getElementById('opLogoutBtn').addEventListener('click', async () => {
            await signOut(auth);
            window.switchView('order-view');
        });

        // ==========================================
        // 4. OPERATOR DASHBOARD
        // ==========================================
        window.allOrders = [];
        window.currentFilter = 'all';
        
        window.filterOrders = function(tab) {
            const tabs = ['all', 'pending', 'approved', 'rejected', 'ready', 'picked_up', 'report'];
            tabs.forEach(t => {
                const btn = document.getElementById(`tab-${t}`);
                if(btn) {
                    if (t === 'report') {
                        btn.className = "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors text-pine hover:text-pine-dark bg-mint whitespace-nowrap";
                    } else {
                        btn.className = "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors text-gray-500 hover:text-gray-900 whitespace-nowrap";
                    }
                }
            });
            
            const activeBtn = document.getElementById(`tab-${tab}`);
            if(activeBtn) {
                if (tab === 'report') {
                    activeBtn.className = "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors bg-pine text-white shadow-sm whitespace-nowrap";
                } else {
                    activeBtn.className = "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors bg-white shadow-sm text-pine whitespace-nowrap";
                }
            }

            if (tab === 'report') {
                document.getElementById('operatorOrdersList').classList.add('hidden');
                document.getElementById('operatorReportView').classList.remove('hidden');
                calculateReport();
            } else {
                document.getElementById('operatorReportView').classList.add('hidden');
                document.getElementById('operatorOrdersList').classList.remove('hidden');
                window.currentFilter = tab;
                renderOrders();
            }
        };
        
        function calculateReport() {
            let todaySales = 0;
            let monthSales = 0;
            const now = new Date();
            
            window.allOrders.forEach(o => {
                if (o.status !== 'ready' && o.status !== 'picked_up') return;
                
                const orderDate = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
                if (!orderDate || isNaN(orderDate.getTime())) return;
                
                const isToday = orderDate.getDate() === now.getDate() && 
                                orderDate.getMonth() === now.getMonth() && 
                                orderDate.getFullYear() === now.getFullYear();
                                
                const isThisMonth = orderDate.getMonth() === now.getMonth() && 
                                    orderDate.getFullYear() === now.getFullYear();
                                    
                const price = parseFloat(o.totalPrice) || 0;
                
                if (isToday) todaySales += price;
                if (isThisMonth) monthSales += price;
            });
            
            document.getElementById('todaySales').textContent = `RM ${todaySales.toFixed(2)}`;
            document.getElementById('monthSales').textContent = `RM ${monthSales.toFixed(2)}`;
        }

        async function loadOperatorOrders() {
            const list = document.getElementById('operatorOrdersList');
            try {
                const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
                const querySnapshot = await getDocs(q);
                
                window.allOrders = [];
                querySnapshot.forEach((docSnap) => {
                    window.allOrders.push({ id: docSnap.id, ...docSnap.data() });
                });
                
                renderOrders();
            } catch(e) {
                console.error("Dashboard Load Error", e);
                list.innerHTML = "<p class='text-red-500'>Error loading orders. Check Firestore rules.</p>";
            }
        }
        
        function renderOrders() {
            const list = document.getElementById('operatorOrdersList');
            list.innerHTML = "";
            
            const filtered = window.currentFilter === 'all' 
                ? window.allOrders 
                : window.allOrders.filter(o => o.status === window.currentFilter);
            
            if (filtered.length === 0) {
                list.innerHTML = `<p class="text-gray-500 italic p-6">No orders found for this category.</p>`;
                return;
            }
            
            filtered.forEach((data) => {
                let filesHtml = '';
                let hasFiles = data.files && data.files.length > 0;
                let hasReceipt = !!data.receipt;
                
                if (hasFiles || hasReceipt) {
                    filesHtml = '<div class="mt-4 space-y-3">';
                    
                    if (hasFiles) {
                        data.files.forEach((filePath, index) => {
                            const { data: urlData } = supabaseClient.storage.from('seprint-files').getPublicUrl(filePath);
                            const url = urlData.publicUrl;
                            const fileName = filePath.split('/').pop() || `File ${index + 1}`;
                            
                            filesHtml += `
                                <div class="flex items-center gap-3">
                                    <span class="text-sm text-gray-700 font-medium truncate max-w-[200px]" title="${fileName}">${fileName}</span>
                                    <button onclick="window.previewFile('${url}')" class="text-xs bg-mint hover:bg-pine text-pine hover:text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm flex items-center gap-1">
                                        <i data-feather="eye" class="w-3 h-3"></i> Preview / Print
                                    </button>
                                </div>
                            `;
                        });
                    }
                    
                    if (hasReceipt) {
                        const { data: receiptUrlData } = supabaseClient.storage.from('seprint-files').getPublicUrl(data.receipt);
                        const receiptUrl = receiptUrlData.publicUrl;
                        
                        const borderClass = hasFiles ? 'border-t border-gray-100 pt-2 mt-1' : '';
                        filesHtml += `
                            <div class="flex items-center gap-3 ${borderClass}">
                                <span class="text-sm text-pine font-bold truncate max-w-[200px]">Payment Receipt</span>
                                <button onclick="window.previewFile('${receiptUrl}')" class="text-xs bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm flex items-center gap-1">
                                    <i data-feather="dollar-sign" class="w-3 h-3"></i> View Receipt
                                </button>
                            </div>
                        `;
                    }
                    
                    filesHtml += '</div>';
                }

                list.innerHTML += `
                    <div class="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col sm:flex-row justify-between gap-4">
                        <div>
                            <h3 class="text-lg font-bold text-gray-900">${data.id}</h3>
                            <p class="text-sm text-gray-500">Customer: <span class="font-medium text-gray-800">${data.customerName}</span></p>
                            <div class="flex items-center gap-2 mt-0.5 mb-1">
                                <p class="text-sm text-gray-500">Phone: <span class="font-medium text-gray-800">${data.customerPhone}</span></p>
                                <button onclick="copyToClipboard('${data.customerPhone}', this)" class="text-gray-400 hover:text-pine transition-colors p-1 rounded-md hover:bg-gray-50" title="Copy Phone Number">
                                    <i data-feather="copy" class="w-3.5 h-3.5"></i>
                                </button>
                            </div>
                            <p class="text-sm text-gray-500 mt-1">Status: <span class="font-bold uppercase text-pine">${data.status}</span></p>
                            <p class="text-sm text-pine font-medium mt-1">Total Paid: RM ${data.totalPrice ? data.totalPrice.toFixed(2) : '0.00'}</p>
                            ${filesHtml}
                        </div>
                        <div class="flex flex-col justify-center gap-2">
                            <select onchange="window.updateStatus('${data.id}', this.value)" class="px-3 py-2 border rounded-lg bg-gray-50 outline-none">
                                <option value="pending" ${data.status==='pending'?'selected':''}>Pending</option>
                                <option value="approved" ${data.status==='approved'?'selected':''}>Approved</option>
                                <option value="rejected" ${data.status==='rejected'?'selected':''}>Rejected</option>
                                <option value="ready" ${data.status==='ready'?'selected':''}>Ready</option>
                                <option value="picked_up" ${data.status==='picked_up'?'selected':''}>Picked Up</option>
                            </select>
                            <button onclick="window.deleteOrder('${data.id}')" class="px-3 py-2 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 flex items-center justify-center gap-1 transition-colors text-sm font-medium">
                                <i data-feather="trash-2" class="w-4 h-4"></i> Delete
                            </button>
                        </div>
                    </div>
                `;
            });
            setTimeout(() => { if (typeof feather !== 'undefined') feather.replace(); }, 10);
        }

        window.updateStatus = async (orderId, newStatus) => {
            try {
                await updateDoc(doc(db, "orders", orderId), { status: newStatus });
                alert(`Status updated to ${newStatus}`);
                
                const order = window.allOrders.find(o => o.id === orderId);
                if(order) order.status = newStatus;
                
                if (window.currentFilter === 'report') {
                    calculateReport();
                } else if (window.currentFilter !== 'all') {
                    renderOrders();
                } else {
                    renderOrders(); // Re-render to show updated status text
                }
            } catch(e) {
                console.error(e);
                alert("Error updating status. See console.");
            }
        };

        window.deleteOrder = async (orderId) => {
            if (!confirm("Are you sure you want to delete this order?")) return;
            try {
                const orderData = window.allOrders.find(o => o.id === orderId);
                if (orderData) {
                    const filesToRemove = [];
                    if (orderData.files && orderData.files.length) filesToRemove.push(...orderData.files);
                    if (orderData.receipt) filesToRemove.push(orderData.receipt);
                    if (filesToRemove.length > 0) {
                        const { error } = await supabaseClient.storage.from('seprint-files').remove(filesToRemove);
                        if (error) console.error("Supabase file delete error:", error);
                    }
                }
                
                await deleteDoc(doc(db, "orders", orderId));
                window.allOrders = window.allOrders.filter(o => o.id !== orderId);
                if (window.currentFilter === 'report') {
                    calculateReport();
                } else {
                    renderOrders();
                }
            } catch (e) {
                console.error(e);
                alert("Error deleting order. See console.");
            }
        };

        let pendingCancelOrderId = null;
        let pendingCancelPhone = null;
        let pendingCancelCost = 0;

        window.cancelOrder = (orderId, actualPhone) => {
            pendingCancelOrderId = orderId;
            pendingCancelPhone = actualPhone;
            document.getElementById('cancelPhoneConfirm').value = '';
            document.getElementById('cancelErrorText').classList.add('hidden');
            document.getElementById('cancelOrderModal').classList.remove('hidden');
        };

        window.closeCancelModal = () => {
            document.getElementById('cancelOrderModal').classList.add('hidden');
            pendingCancelOrderId = null;
            pendingCancelPhone = null;
        };

        window.closeCancelSuccessModal = () => {
            document.getElementById('cancelSuccessModal').classList.add('hidden');
        };

        window.requestRefund = () => {
            document.getElementById('cancelSuccessModal').classList.add('hidden');
            const enteredPhone = document.getElementById('cancelPhoneConfirm').value.trim();
            const message = `Hello, I cancelled my order. My phone number is ${enteredPhone}. I would like to request a refund for the amount of RM ${parseFloat(pendingCancelCost).toFixed(2)}.`;
            const encodedMessage = encodeURIComponent(message);
            window.open(`https://t.me/Emirmir?text=${encodedMessage}`, '_blank');
        };

        document.getElementById('confirmCancelBtn').addEventListener('click', async () => {
            const enteredPhone = document.getElementById('cancelPhoneConfirm').value;
            if (enteredPhone.trim() !== String(pendingCancelPhone).trim()) {
                document.getElementById('cancelErrorText').classList.remove('hidden');
                return;
            }
            
            const btn = document.getElementById('confirmCancelBtn');
            const originalContent = btn.innerHTML;
            btn.innerHTML = `<span>Cancelling...</span>`;
            btn.disabled = true;

            try {
                const docSnap = await getDoc(doc(db, "orders", pendingCancelOrderId));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    pendingCancelCost = data.totalPrice || 0;
                    const filesToRemove = [];
                    if (data.files && data.files.length) filesToRemove.push(...data.files);
                    if (data.receipt) filesToRemove.push(data.receipt);
                    if (filesToRemove.length > 0) {
                        const { error } = await supabaseClient.storage.from('seprint-files').remove(filesToRemove);
                        if (error) console.error("Supabase file delete error:", error);
                    }
                }

                await deleteDoc(doc(db, "orders", pendingCancelOrderId));
                
                window.closeCancelModal();
                document.getElementById('statusResult').classList.add('hidden');
                document.getElementById('trackId').value = '';
                document.getElementById('cancelSuccessModal').classList.remove('hidden');
            } catch (e) {
                console.error(e);
                alert("Error: " + e.message + "\nMaybe Firebase rules block customer delete?");
            } finally {
                btn.innerHTML = originalContent;
                btn.disabled = false;
                if (typeof feather !== 'undefined') feather.replace();
            }
        });

        window.previewFile = (url) => {
            window.open(url, '_blank');
        };

        // ==========================================
        // 5. CUSTOMER TRACKING
        // ==========================================
        document.getElementById('trackOrderBtn').addEventListener('click', async () => {
            const trackId = document.getElementById('trackId').value;
            if(!trackId) return;

            try {
                const docSnap = await getDoc(doc(db, "orders", trackId));
                if(docSnap.exists()) { 
                    const data = docSnap.data();
                    document.getElementById('statusResult').classList.remove('hidden');
                    
                    let color = (data.status === 'ready' || data.status === 'picked_up') ? 'green' : data.status === 'approved' ? 'indigo' : data.status === 'rejected' ? 'red' : 'blue';
                    let icon = data.status === 'ready' ? 'check-circle' : data.status === 'picked_up' ? 'package' : data.status === 'approved' ? 'printer' : data.status === 'rejected' ? 'x-circle' : 'info';

                    let cancelButtonHtml = (data.status !== 'ready' && data.status !== 'picked_up') 
                        ? `<button onclick="window.cancelOrder('${trackId}', '${data.customerPhone}')" class="px-4 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg text-sm font-medium transition-colors shrink-0">Cancel Order</button>`
                        : '';

                    document.getElementById('status-banner').innerHTML = `
                        <div class="bg-${color}-50 border-l-4 border-${color}-500 p-4 rounded-r-xl flex items-start justify-between gap-3">
                            <div class="flex items-start gap-3">
                                <i data-feather="${icon}" class="w-6 h-6 text-${color}-500 mt-0.5"></i>
                                <div>
                                    <h4 class="text-${color}-800 font-bold uppercase">Status: ${data.status}</h4>
                                    <p class="text-sm text-${color}-600 mt-1">Order for ${data.customerName}</p>
                                </div>
                            </div>
                            ${cancelButtonHtml}
                        </div>`;
                    feather.replace();
                } else { 
                    alert("Order not found in Firestore."); 
                }
            } catch(e) {
                console.error(e);
                alert("Error tracking order. See console.");
            }
        });

        document.getElementById('findOrderBtn').addEventListener('click', async () => {
            const phone = document.getElementById('findPhone').value.trim();
            if(!phone) return;

            const btn = document.getElementById('findOrderBtn');
            const originalContent = btn.innerHTML;
            btn.innerHTML = `<i data-feather="loader" class="w-5 h-5 animate-spin"></i>`;
            if (typeof feather !== 'undefined') feather.replace();
            btn.disabled = true;

            const listEl = document.getElementById('foundOrdersList');
            listEl.innerHTML = '';
            listEl.classList.remove('hidden');

            try {
                const q = query(collection(db, "orders"), where("customerPhone", "==", phone));
                const querySnapshot = await getDocs(q);
                
                if(querySnapshot.empty) {
                    listEl.innerHTML = `<div class="bg-red-50 text-red-600 p-4 rounded-xl text-center">No orders found for ${phone}.</div>`;
                } else {
                    let orders = [];
                    querySnapshot.forEach(docSnap => orders.push({ id: docSnap.id, ...docSnap.data() }));
                    
                    const getTime = (val) => {
                        if (!val) return 0;
                        if (val.toDate) return val.toDate().getTime();
                        if (val.seconds) return val.seconds * 1000;
                        return new Date(val).getTime() || 0;
                    };
                    
                    orders.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));

                    let html = `<h4 class="text-lg font-bold text-gray-800 mb-4">Orders for ${phone}:</h4>`;
                    orders.forEach(data => {
                        let dateStr = 'Unknown date';
                        if (data.createdAt) {
                            if (data.createdAt.toDate) dateStr = data.createdAt.toDate().toLocaleString();
                            else if (data.createdAt.seconds) dateStr = new Date(data.createdAt.seconds * 1000).toLocaleString();
                            else {
                                const d = new Date(data.createdAt);
                                if (!isNaN(d.getTime())) dateStr = d.toLocaleString();
                            }
                        }
                        html += `
                            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                                <div>
                                    <p class="font-bold text-pine">ID: <span class="tracking-wider cursor-pointer hover:text-pine-light" onclick="document.getElementById('trackId').value='${data.id}'; document.getElementById('trackOrderBtn').click();" title="Click to track">${data.id}</span></p>
                                    <p class="text-sm text-gray-500 mt-1">${dateStr} &bull; <span class="uppercase font-medium">${data.status}</span></p>
                                </div>
                                <button onclick="document.getElementById('trackId').value='${data.id}'; document.getElementById('trackOrderBtn').click(); window.scrollTo({ top: 0, behavior: 'smooth' });" class="p-2 bg-gray-50 hover:bg-mint rounded-lg text-pine transition-colors">
                                    <i data-feather="arrow-up-right" class="w-5 h-5"></i>
                                </button>
                            </div>
                        `;
                    });
                    listEl.innerHTML = html;
                    if (typeof feather !== 'undefined') feather.replace();
                }
            } catch(e) {
                console.error(e);
                listEl.innerHTML = `<div class="bg-red-50 text-red-600 p-4 rounded-xl text-sm text-center"><strong>Error:</strong> ${e.message}<br><br>If "Missing or insufficient permissions", you need to update Firestore Rules to allow 'list' (or 'read') for the 'orders' collection.</div>`;
            } finally {
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }
        });

