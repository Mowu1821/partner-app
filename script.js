const mainbox = document.getElementById('login-card');

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

  // Polling for authentication status
  const poll = async () => {
    attempts++;

    try {
      console.log("Proceed to polling");
      const response = await fetch(`https://proj-ei-d-backend.vercel.app/api/auth/status/${orderId}`);
      // const response = await fetch(`http://localhost:5000/api/auth/status/${orderId}`);

      if (!response.ok) {
        console.error('Failed to get authentication status');
        return;
      }

      const result = await response.json();

      console.log("result", result);
      console.log("response", response);
      if (response.status === 200 && result?.data?.status === "Scanned") {
        // Clear QR code container with lock icon
        const qrCodeContainer = document.getElementById("qr-code-container");
        if (qrCodeContainer) {
          qrCodeContainer.innerHTML = `
            <div class="lock-loader">
                <svg class="lock-icon" viewBox="0 0 24 24">
                    <path class="lock-body" d="M12 2C9.24 2 7 4.24 7 7v3H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V12c0-1.1-.9-2-2-2h-1V7c0-2.76-2.24-5-5-5zm0 2c1.66 0 3 1.34 3 3v3H9V7c0-1.66 1.34-3 3-3z"/>
                    <path class="lock-shackle" d="M12 14c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                    <path class="lock-pin-progress" d="M12 14v3"/>
                </svg>
            </div>
        `;
        }

        // Update main content
        mainbox.innerHTML = `
        <h2>Enter security PIN in MyID app</h2>
        <div class="pin-status">
            <svg class="pin-icon" viewBox="0 0 24 24">
                <path class="pin-digit" d="M11 12h2v4h-2z"/>
                <path class="pin-digit" d="M11 8h2v2h-2z"/>
                <path class="pin-digit" d="M15 12h2v4h-2z"/>
                <path class="pin-digit" d="M7 12h2v4H7z"/>
            </svg>
            <p class="status-text">Waiting for PIN verification<span class="ellipsis"></span></p>
        </div>
    `;

        // Continue polling
        setTimeout(poll, interval);
      }

      else if (response.status === 200 && result?.data?.status === "Completed") {
        // If the status is completed, fetch the user data and render the dashboard
        console.log("Authentication successful. Rendering dashboard...");
        const userData = result.data.user;
        renderUserDashboardPage(userData); // Pass user data to dashboard function
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
        requestBodyName: "TestWebsite.com"
      }),
    });

    const result = await response.json();
    return result.data; // Contains orderID, tokens

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

  const orderId = authData.sameDevice.orderID; // assuming orderID is part of result.data

  if (orderId) {
    // Start polling for the authentication status
    pollAuthenticationStatus(orderId);
  }

  const deepLinkUrl = `myapp://identify?callback_url=${callBackUrl}&orderID=${authData.sameDevice.orderID}&token=${authData.sameDevice.autoTriggerToken}&requestBodyName=${authData.requestBodyName}`;
  window.open(deepLinkUrl, "_blank");
}

// Generate QR Code for another device
async function generateQRCodeForAnotherDevice() {
  const authData = await initiateAuthentication();
  if (!authData) return;

  const orderId = authData.differentDevice.orderID; // assuming orderID is part of result.data

  if (orderId) {
    // Start polling for the authentication status
    pollAuthenticationStatus(orderId);
  }


  // const qrCodeData = `myapp://auth?orderID=${authData.differentDevice.orderID}&token=${authData.differentDevice.qrCodeToken}&qrCodePassString=${authData.differentDevice.qrCodePassString}&requestBodyName=${authData.requestBodyName}`;
  const qrCodeData = `myapp://identify?callback_url=${callBackUrl}&orderID=${authData.differentDevice.orderID}&token=${authData.differentDevice.qrCodeToken}&qrCodePassString=${authData.differentDevice.qrCodePassString}&requestBodyName=${authData.requestBodyName}`;

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