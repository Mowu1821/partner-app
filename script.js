const mainbox = document.getElementById('login-card');

const DB_NAME = "CryptoKeysDB";
const STORE_NAME = "keys";
const KEY_ID = "authKey";
const PUBLIC_KEY_CACHE_KEY = "publicKeyPem";
const callBackUrl = `https://partner-app-drab.vercel.app/user.html`;
const clientApp = `IntegrationPartner`;

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

function normalizeBase64(b64) {
  return b64.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64.length / 4) * 4, '=');
} 

// Helper to generate HMAC using qrcodeSecret and timestamp
async function generateHMAC(secretBase64, timestamp) {
  const secretBytes = Uint8Array.from(atob(normalizeBase64(secretBase64)), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const msgBuffer = new TextEncoder().encode(timestamp.toString());
  const hmacBuffer = await crypto.subtle.sign('HMAC', key, msgBuffer);
  return Array.from(new Uint8Array(hmacBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Render myID-compliant moving QR code
async function renderMyIDMovingQRCode(qrcodeToken, qrcodeSecret) {
  const container = document.getElementById("qr-code-container");

  async function updateQR() {
    const timestamp = Math.floor(Date.now() / 1000);
    const hmac = await generateHMAC(qrcodeSecret, timestamp);
    const encodedClientApp = encodeURIComponent(CONFIG.clientApp);
    const qrString = `myid.${qrcodeToken}.${timestamp}.${hmac}`;
    const qrCodeData = `myapp://identify.${qrcodeToken}.${timestamp}.${hmac}.${encodedClientApp}`;

    console.log("QrLink", qrCodeData);

    const qr = qrcode(0, "M");
    qr.addData(qrCodeData);
    qr.make();

    if (container) {
      container.innerHTML = qr.createImgTag(4, 4);
    }
  }

  await updateQR();
  const intervalId = setInterval(updateQR, 1000);
  setTimeout(() => clearInterval(intervalId), 180000); // 3 minutes TTL
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
  localStorage.setItem('userDetails', JSON.stringify(userDetails));

  // Optional: Store the timestamp for timeout check (in case you want it)
  localStorage.setItem('userDetailsTimestamp', Date.now());

  // Redirect to user.html
  window.location.href = 'user.html';
}

// Function Polling for authentication status
async function pollAuthenticationStatus(orderId, maxAttempts = 60, interval = 3000) {
  let attempts = 0;


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
            },
            ipAddress: "192.168.1.1"
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

        mainbox.innerHTML = `
              <h2>Verification Successful!</h2>
              <div class="decryption-status">
                  <div class="loader"></div>
                  <p>Finalizing secure connection...</p>
              </div>
          `;

        try {
          mainbox.innerHTML = `
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
          renderUserDashboardPage(result.data.user); // Pass user data to dashboard function

        } catch (err) {
          console.error("Decryption failed:", err);

          // Show error state
          mainbox.innerHTML = `
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
        callBackUrl,
        clientApp
      }),
    });

    const result = await response.json();
    console.log("result", result);

    return result.data;

  } catch (error) {
    console.error("Error initiating authentication:", error);
    alert("Failed to authenticate.");
  }
}


// Login with MyID on the Same Device (Deep Link)
async function loginWithMyIDOnSameDevice() {
  const authData = await initiateAuthentication();
  if (!authData) return;

  const orderId = authData.orderID;

  if (orderId) {
    // Start polling for the authentication status
    pollAuthenticationStatus(orderId);
  }
  const encodedClientApp = encodeURIComponent(CONFIG.clientApp);
  const deepLinkUrl = `myapp://identify?callback_url=${callBackUrl}&token=${authData.deepLinkToken}.${encodedClientApp}`;
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

  mainbox.innerHTML = `
    <h2>Scan this QR Code with MyID on your mobile</h2>
    <div id="qr-code-container"></div>
    <p>This QR code updates every second and expires in 3 minutes.</p>
  `;

  await renderMyIDMovingQRCode(authData.qrCodeToken, authData.qrCodeSecret);
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
