const mainbox = document.getElementById('login-card');

const DB_NAME = "CryptoKeysDB";
const STORE_NAME = "keys";
const KEY_ID = "authKey";
const PUBLIC_KEY_CACHE_KEY = "publicKeyPem";

// Generate keys for encryption
async function getOrCreateKeyPair() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const privateKey = await tx.objectStore(STORE_NAME).get(KEY_ID);
  await tx.done;

  const publicKeyPem = localStorage.getItem(PUBLIC_KEY_CACHE_KEY);

  // If both keys exist, return them
  if (privateKey && publicKeyPem) {
    return { privateKey, publicKeyPem };
  }

  // Generate a fresh key pair
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const exportedPrivateKey = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  // console.log("Stored key type:", Object.prototype.toString.call(exportedPrivateKey));

  const privateKeyPemNew = convertToPem(exportedPrivateKey, "PRIVATE KEY");

  // Store private key in IndexedDB
  const writeTx = db.transaction(STORE_NAME, "readwrite");
  await writeTx.objectStore(STORE_NAME).put(privateKeyPemNew, KEY_ID);
  await writeTx.done;

  // Export and store public key in localStorage
  const exportedPublicKey = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const publicKeyPemNew = convertToPem(exportedPublicKey, "PUBLIC KEY");
  localStorage.setItem(PUBLIC_KEY_CACHE_KEY, publicKeyPemNew);

  return { privateKey: keyPair.privateKey, publicKeyPem: publicKeyPemNew };
}

// Convert generated keys to .pem format
function convertToPem(binaryData, label) {
  const base64 = window.btoa(String.fromCharCode(...new Uint8Array(binaryData)));
  const formatted = base64.match(/.{1,64}/g).join("\n");
  return `-----BEGIN ${label}-----\n${formatted}\n-----END ${label}-----`;
}

function base64UrlToBase64(base64url) {
  return base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
}

// Convert base64 format to arrayBuffer
function _base64StringToArrayBuffer(base64) {
  const normalized = base64UrlToBase64(base64);
  const binaryStr = atob(normalized);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes.buffer;
}

// Convert .pem format to arrayBuffer
function _convertPemToArrayBuffer(pem) {
  console.log("Key pem", pem);
  const lines = pem.split('\n')
  let encoded = ''
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length > 0 &&
      lines[i].indexOf('-----BEGIN PRIVATE KEY-----') < 0 &&
      lines[i].indexOf('-----BEGIN PUBLIC KEY-----') < 0 &&
      lines[i].indexOf('-----END PRIVATE KEY-----') < 0 &&
      lines[i].indexOf('-----END PUBLIC KEY-----') < 0) {
      encoded += lines[i].trim()
    }
  }
  return _base64StringToArrayBuffer(encoded)
}

// Retrive key from database
async function getStoredPrivateKey() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const exportedPrivatePem = await new Promise((resolve, reject) => {
      const request = store.get(KEY_ID);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // console.log("Retrived pem", exportedPrivatePem);

    if (!exportedPrivatePem) {
      console.warn("No private key found in IndexedDB.");
      return null;
    }

    const keyArrayBuffer = _convertPemToArrayBuffer(exportedPrivatePem);

    const privateKey = await window.crypto.subtle.importKey(
      "pkcs8",
      keyArrayBuffer,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["decrypt"]
    );
    console.log("Retrieved key type:", Object.prototype.toString.call(privateKey));
    return privateKey;
  } catch (err) {
    console.error("Error retrieving private key from IndexedDB:", err);
    return null;
  }
}


// Function to access database
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = function (event) {
      const db = event.target.result;

      //  Check if object store already exists
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = function (event) {
      resolve(event.target.result);
    };

    request.onerror = function (event) {
      reject("IndexedDB error: " + event.target.errorCode);
    };
  });
}

// Helper to convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
  const binaryStr = atob(base64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes.buffer;
}

// Function to decrypt data
async function decryptData(base64EncryptedData) {
  const privateKey = await getStoredPrivateKey();
  if (!privateKey) throw new Error("Private key not found in IndexedDB.");

  const encryptedBuffer = base64ToArrayBuffer(base64EncryptedData);

  console.log("Private key from database", privateKey)

  const decrypted = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    encryptedBuffer
  );

  const decryptedText = new TextDecoder().decode(decrypted);
  return JSON.parse(decryptedText);
}

// Random user details generator
function generateRandomUserDetails() {
  const names = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];
  const emails = ['alice@example.com', 'bob@example.com', 'charlie@example.com', 'david@example.com', 'eve@example.com'];
  const ids = [1001, 1002, 1003, 1004, 1005];

  const randomIndex = Math.floor(Math.random() * names.length);
  return {
    name: names[randomIndex],
    email: emails[randomIndex],
    id: ids[randomIndex]
  };
}

function renderLoginPage() {

  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get("orderID"); // assuming orderID is part of result.data
  console.log("Order ID from URL:", orderId);

  if (orderId) {
    // Start polling for the authentication status
    pollAuthenticationStatus(orderId);
  }
}

// Render User Dashboard Page
function renderUserDashboardPage(userDetails) {
  // const userDetails = generateRandomUserDetails();
  console.log("In the render dashboad");

  // Store user data in sessionStorage
  sessionStorage.setItem('userDetails', JSON.stringify(userDetails));

  // Optional: Store the timestamp for timeout check (in case you want it)
  sessionStorage.setItem('userDetailsTimestamp', Date.now());

  // Redirect to user.html
  window.location.href = 'user.html';
}

// Function Polling for authentication status
async function pollAuthenticationStatus(orderId, maxAttempts = 60, interval = 3000) {
  let attempts = 0;

  const { privateKey, publicKeyPem } = await getOrCreateKeyPair();

  // Polling for authentication status
  const poll = async () => {
    attempts++;

    try {
      console.log("Proceed to polling");
      const response = await fetch(`https://proj-ei-d-backend.vercel.app/api/auth/status`
      // const response = await fetch(`http://localhost:5000/api/auth/status`
        , {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderId: `${orderId}`, // Replace with actual user IP
            deviceInfo: {
              deviceModel: "Pixel 6",
              deviceOS: "Android 13",
            }
          }),
        }
      );

      if (!response.ok) {
        console.error('Failed to get authentication status');
        return;
      }

      const result = await response.json();

      console.log("result", result);
      console.log("response", response);

      if (response.status === 200 && result?.data?.status === "Scanned") {
          // Replace QR code with animated lock
          const qrCodeContainer = document.getElementById("qr-code-container");
          if (qrCodeContainer) {
              qrCodeContainer.innerHTML = `
                  <div class="lock-verification">
                      <svg class="animated-lock" viewBox="0 0 24 24">
                          <path class="lock-body" d="M12 3a4 4 0 0 1 4 4v2h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h1V7a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v2h4V7a2 2 0 0 0-2-2z"/>
                          <path class="lock-shackle" d="M12 14a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                          <path class="lock-pin-progress" d="M12 16v-2"/>
                      </svg>
                  </div>
              `;
          }
      
          // Update main content
          mainbox.innerHTML = `
              <h2>Enter security PIN in MyID app</h2>
              <div class="pin-status">
                  <div class="pin-digits">
                      ${Array(4).fill('<div class="pin-digit"></div>').join('')}
                  </div>
                  <p class="status-text">Verifying PIN<span class="ellipsis"></span></p>
              </div>
          `;
          
          // Continue polling
          setTimeout(poll, interval);
      }
      else if (response.status === 200 && result?.data?.status === "Completed") {

          // If the status is completed, fetch the user data and render the dashboard
          console.log("Authentication successful. Decrypt and Rendering dashboard...");
          // Show immediate success feedback
          const qrCodeContainer = document.getElementById("qr-code-container");
          if (qrCodeContainer) {
              qrCodeContainer.innerHTML = `
                  <div class="success-icon">
                      <svg viewBox="0 0 24 24">
                          <path fill="#34A853" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                  </div>
              `;
          }
      
          app.innerHTML = `
              <h2>Verification Successful!</h2>
              <div class="decryption-status">
                  <div class="loader"></div>
                  <p>Finalizing secure connection...</p>
              </div>
          `;
      
          try {
              // 1. Show decryption in progress
              const decryptedPayload = await decryptData(result.data.user);
              
              // 2. Brief display of success before redirect
              app.innerHTML = `
                  <h2>Security Verified!</h2>
                  <div class="success-message">
                      <svg viewBox="0 0 24 24" width="48" height="48">
                          <path fill="#34A853" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                      </svg>
                      <p>Redirecting to your account...</p>
                  </div>
              `;
      
              // 3. Short delay for user to see confirmation
              await new Promise(resolve => setTimeout(resolve, 1500));
              
              // 4. Redirect with decrypted data
              renderUserDashboardPage(decryptedPayload); // Pass user data to dashboard function
      
          } catch (err) {
              console.error("Decryption failed:", err);
              
              // Show error state
              app.innerHTML = `
                  <h2>Security Verification Failed</h2>
                  <div class="error-state">
                      <svg viewBox="0 0 24 24" width="48" height="48">
                          <path fill="#EA4335" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                      </svg>
                      <p>Could not establish secure connection. Please try again.</p>
                      <button id="retry-btn" class="btn">Retry Verification</button>
                  </div>
              `;
      
              document.getElementById('retry-btn').addEventListener('click', poll);
          }
     }
      else if (attempts < maxAttempts) {
        // Poll again if status is still pending
        setTimeout(poll, interval);
      } else {
        console.log('Max polling attempts reached. Authentication still pending.');
        alert('Authentication still pending.');
      }
    } catch (error) {
      console.error('Error polling authentication status:', error);
    }
  };

  // Start polling
  poll();
}

// Call API before proceeding with login method
async function initiateAuthentication() {
  try {

    const { privateKey, publicKeyPem } = await getOrCreateKeyPair(); // Only once per session/browser

    // console.log("private key========", privateKey);
    // if (publicKeyPem instanceof CryptoKey) {
    //   console.log("public key========", publicKeyPem);
    // }

    const response = await fetch("https://proj-ei-d-backend.vercel.app/api/authenticate", {
    // const response = await fetch("http://localhost:5000/api/authenticate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ipAddress: "192.168.1.1", // Replace with actual user IP
        deviceInfo: {
          deviceModel: "Pixel 6",
          deviceOS: "Android 13",
        },
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
        },
        requestBodyName: "TestWebsite.com",
        publicKey: publicKeyPem
      }),
    });

    const result = await response.json();
    console.log("result", result);
    let decryptedPayload;
    try {
      decryptedPayload = await decryptData(result.data);
      // console.log("Decrypted:", decryptedPayload);
    } catch (err) {
      console.error("Decryption failed:", err);
    }
    return decryptedPayload; // Contains orderID, tokens

  } catch (error) {
    console.error("Error initiating authentication:", error);
    alert("Failed to authenticate.");
  }
}

const callBackUrl = `https://partner-app-seven.vercel.app/?orderID`;

// Login with MyID on the Same Device (Deep Link)
async function loginWithMyIDOnSameDevice() {
  const authData = await initiateAuthentication();
  if (!authData) return;

  const orderId = authData.orderID;

  if (orderId) {
    // Start polling for the authentication status
    pollAuthenticationStatus(orderId);
  }

  const deepLinkUrl = `myapp://identify?callback_url=${callBackUrl}&orderID=${authData.orderID}&token=${authData.nonce}&requestBodyName=${authData.clientApp}`;
  window.open(deepLinkUrl, "_blank");
}

// Generate QR Code for another device
async function generateQRCodeForAnotherDevice() {
  const authData = await initiateAuthentication();
  if (!authData) return;

  const orderId = authData.orderID; // assuming orderID is part of result.data

  if (orderId) {
    // Start polling for the authentication status
    pollAuthenticationStatus(orderId);
  }


  // const qrCodeData = `myapp://auth?orderID=${authData.differentDevice.orderID}&token=${authData.differentDevice.qrCodeToken}&qrCodePassString=${authData.differentDevice.qrCodePassString}&requestBodyName=${authData.requestBodyName}`;
  const qrCodeData = `myapp://identify?callback_url=${callBackUrl}&orderID=${authData.orderID}&token=${authData.nonce}&requestBodyName=${authData.clientApp}`;

  console.log("QR Code Data:", qrCodeData);

  // Display the QR code
  mainbox.innerHTML = '';
  mainbox.innerHTML = `
    <h2>Scan this QR Code on another device</h2>
    <div id="qr-code-container"></div>
    <p>This QR code contains a secure token for authentication.</p>
  `;

  setTimeout(() => {
    const qrCodeContainer = document.getElementById("qr-code-container");
    if (!qrCodeContainer) {
      console.error("Error: QR code container not found in the DOM.");
      return;
    }

    const qr = qrcode(0, "M");
    qr.addData(qrCodeData);
    qr.make();

    const imgTag = qr.createImgTag(4, 4);
    qrCodeContainer.innerHTML = imgTag;
  }, 0);
}

// Helper function to generate a random token
function generateRandomToken(length = 16) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Initial page load
renderLoginPage();
