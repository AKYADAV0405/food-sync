import { useState } from "react";
import "../assets/styles/login.css";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault(); // stop page reload
  };

  return (
    <div className="login-page">
      <div className={`login-container ${isRegister ? "active" : ""}`}>

        {/* 🔐 SIGN IN */}
        <div className="form-container sign-in">
          {!forgotPassword ? (
            <form onSubmit={handleSubmit} autoComplete="off">
              <h1>Log In</h1>

              <input
                type="email"
                placeholder="Email"
                required
              />

              <input
                type="password"
                placeholder="Password"
                required
              />

              {/* 🔑 FORGOT PASSWORD */}
              <p
                className="forgot-password"
                onClick={() => setForgotPassword(true)}
              >
                Forgot password?
              </p>

              <button type="submit">Sign In</button>

              <p className="switch-text">
                New to Food Sync?
                <span onClick={() => setIsRegister(true)}>
                  {" "}Create Account
                </span>
              </p>
            </form>
          ) : (
            /* 🔁 RESET PASSWORD */
            <form onSubmit={handleSubmit}>
              <h1>Reset Password</h1>

              <p className="reset-text">
                Enter your email to receive a password reset link.
              </p>

              <input
                type="email"
                placeholder="Email address"
                required
              />

              <button type="submit">Send Reset Link</button>

              <p className="switch-text">
                Remembered your password?
                <span onClick={() => setForgotPassword(false)}>
                  {" "}Go back
                </span>
              </p>
            </form>
          )}
        </div>

        {/* 🆕 SIGN UP */}
        <div className="form-container sign-up">
          <form onSubmit={handleSubmit} autoComplete="off">
            <h1>Create Account</h1>

            <input
              type="text"
              placeholder="Full Name"
              required
            />

            <input
              type="email"
              placeholder="Email"
              required
            />

            <input
              type="tel"
              placeholder="Phone Number"
              required
            />

            <input
              type="text"
              placeholder="State"
              required
            />

            <input
              type="password"
              placeholder="Password"
              required
            />

            <button type="submit">Sign Up</button>

            <p className="switch-text">
              Already have an account?
              <span onClick={() => setIsRegister(false)}>
                {" "}Sign In
              </span>
            </p>
          </form>
        </div>

        {/* 🌈 OVERLAY */}
        <div className="overlay-container">
          <div className="overlay">
            <div className="overlay-panel overlay-left">
              <h1>Welcome Back!</h1>
              <p>
                Login to manage your food inventory & recipes 🍲
              </p>
            </div>

            <div className="overlay-panel overlay-right">
              <h1>Hello, Foodie!</h1>
              <p>
                Join Food Sync & reduce food waste smartly 
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
