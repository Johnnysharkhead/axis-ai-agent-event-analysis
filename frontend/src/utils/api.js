/**
 * api.js
 * Centralized API utility functions for frontend-backend communication.
 * Handles signup, login, logout, and authenticated requests.
 * AUTHORS: Victor, Success, David
 */

import { cacheUser, clearCachedUser } from "./userStorage";

// Backend configuration
const BACKEND_PORT = process.env.REACT_APP_BACKEND_PORT || 5001;
const BASE_URL = `http://localhost:${BACKEND_PORT}`;
const API_URL = `${BASE_URL}/api`;

/**
 * Safe fetch wrapper with error handling
 * @param {string} url - Full URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<object>} Response object with ok, status, body, message
 */
async function safeFetch(url, options = {}) {
	try {
		const res = await fetch(url, {
			headers: { 
				'Content-Type': 'application/json', 
				...(options.headers || {}) 
			},
			credentials: 'include', // Important: sends cookies for session
			...options,
		});
		
		const isJson = (res.headers.get('content-type') || '').includes('application/json');
		const body = isJson ? await res.json() : await res.text();
		
		return { 
			ok: res.ok, 
			status: res.status, 
			body, 
			message: body?.message || (res.ok ? 'Success' : 'Request failed')
		};
	} catch (e) {
		console.error('API Error:', e);
		// Backend offline - return error
		return { 
			ok: false, 
			status: 0, 
			body: null, 
			message: 'Cannot connect to server. Please check if backend is running.' 
		};
	}
}

/**
 * Sign up a new user
 * @param {object} payload - { username, email, password }
 * @returns {Promise<object>} Response with ok status and user data
 */
export async function signupUser(payload) {
	const result = await safeFetch(`${API_URL}/signup`, { 
		method: 'POST',
		body: JSON.stringify(payload)
	});
	
	// Return in expected format for Signup.js
	return {
		ok: result.ok,
		message: result.message,
		user: result.body?.user
	};
}

/**
 * Login an existing user
 * @param {object} payload - { email, password }
 * @returns {Promise<object>} Response with ok status and user data
 */
export async function loginUser(payload) {
	const result = await safeFetch(`${API_URL}/login`, { 
		method: 'POST',
		body: JSON.stringify(payload)
	});

	if (result.ok && result.body?.user) {
		cacheUser(result.body.user);
	}
	
	// Return in expected format for Login.js
	return {
		ok: result.ok,
		message: result.message,
		user: result.body?.user,
		remaining_seconds: result.body?.remaining_seconds
	};
}



/**
 * Logout current user
 * @returns {Promise<object>} Response with ok status
 */
export async function logoutUser() {
	const result = await safeFetch(`${API_URL}/logout`, { 
		method: 'POST'
	});
	
	if (result.ok) {
		clearCachedUser();
	}
	
	return {
		ok: result.ok,
		message: result.message
	};
}

/**
 * Get current logged-in user info
 * @returns {Promise<object>} Response with ok status and user data
 */
export async function getCurrentUser() {
	const result = await safeFetch(`${API_URL}/me`, { 
		method: 'GET'
	});
	
	return {
		ok: result.ok,
		message: result.message,
		user: result.body?.user
	};
}

/**
 * Check if user is authenticated
 * @returns {Promise<boolean>} True if user is logged in
 */
export async function isAuthenticated() {
	const response = await getCurrentUser();
	if (response.ok && response.user) {
		cacheUser(response.user);
		return true;
	}
	clearCachedUser();
	return false;
}


/**
 * Test backend connection
 * @returns {Promise<object>} Response with backend status
 */
export async function testBackend() {
	return safeFetch(`${BASE_URL}/test`, { method: 'GET' });


}

/**
 * Fetch all users (admin only)
 * @returns {Promise<object>} Response with ok status and users array
 */
export async function fetchAllUsers() {
	const result = await safeFetch(`${BASE_URL}/users`, {
		method: 'GET'
	});

	const errorMessage =
		(!result.ok &&
			!Array.isArray(result.body) &&
			typeof result.body === 'object' &&
			result.body !== null &&
			(result.body.message || result.body.error)) ||
		result.message;

	return {
		ok: result.ok,
		message: errorMessage,
		users: Array.isArray(result.body) ? result.body : []
	};
}

/**
 * Update a user's admin flag
 * @param {number} userId
 * @param {boolean} isAdmin
 */
export async function updateUserAdmin(userId, isAdmin) {
	const result = await safeFetch(`${BASE_URL}/users/${userId}/admin`, {
		method: 'PATCH',
		body: JSON.stringify({ is_admin: isAdmin })
	});

	return {
		ok: result.ok,
		message: result.message,
		user: result.body
	};
}

/**
 * Update user block status / reset failed logins
 */
export async function updateUserBlock(userId, { isBlocked, resetFailedAttempts } = {}) {
	const payload = {};
	if (typeof isBlocked === "boolean") {
		payload.is_blocked = isBlocked;
	}
	if (resetFailedAttempts) {
		payload.reset_failed_attempts = true;
	}

	if (Object.keys(payload).length === 0) {
		return {
			ok: false,
			message: "No changes provided"
		};
	}

	const result = await safeFetch(`${BASE_URL}/users/${userId}/block`, {
		method: 'PATCH',
		body: JSON.stringify(payload)
	});

	return {
		ok: result.ok,
		message: result.message,
		user: result.body
	};
}

// AI Service API calls

// Trigger AI analysis
export const triggerAiAnalysis = async () => {
  const response = await fetch(`${API_URL}/ai/latest-analysis`);
  if (!response.ok) {
    const text = await response.text(); // Read text to see the real error
    console.error("Backend Error:", text);
    throw new Error('Failed to generate analysis');
  }
  return response.json();
};

// Fetch AI analysis history
export const getAiHistory = async () => {
  const response = await fetch(`${API_URL}/ai/history`);
  if (!response.ok) throw new Error('Failed to fetch history');
  return response.json();
};