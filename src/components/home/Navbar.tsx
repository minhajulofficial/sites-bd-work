"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGlobe,
  faHome,
  faStar,
  faTags,
  faShoppingCart,
  faEnvelope,
  faRocket,
} from "@fortawesome/free-solid-svg-icons";

import { useCart } from "@/lib/hooks/useCart";
import { useCartDrawer } from "@/components/cart/CartDrawerProvider";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { count: cartCount } = useCart();
  const { openCartDrawer } = useCartDrawer();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 w-full z-50 bg-white shadow-lg ${scrolled ? "shadow-xl" : ""}`}
      data-aos="fade-down"
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="text-primary text-2xl font-bold flex items-center">
            <FontAwesomeIcon icon={faGlobe} className="mr-3 text-3xl" />
            SITES.BD
          </div>
          <div className="hidden md:flex space-x-8">
            <a
              href="#home"
              className="text-gray-700 hover:text-primary transition-colors duration-300 font-medium"
            >
              <FontAwesomeIcon icon={faHome} className="mr-2" /> Home
            </a>
            <a
              href="#features"
              className="text-gray-700 hover:text-primary transition-colors duration-300 font-medium"
            >
              <FontAwesomeIcon icon={faStar} className="mr-2" /> Features
            </a>
            <a
              href="#pricing"
              className="text-gray-700 hover:text-primary transition-colors duration-300 font-medium"
            >
              <FontAwesomeIcon icon={faTags} className="mr-2" /> Pricing
            </a>
            <a
              href="#order"
              className="text-gray-700 hover:text-primary transition-colors duration-300 font-medium"
            >
              <FontAwesomeIcon icon={faShoppingCart} className="mr-2" /> Order
            </a>
            <a
              href="#contact"
              className="text-gray-700 hover:text-primary transition-colors duration-300 font-medium"
            >
              <FontAwesomeIcon icon={faEnvelope} className="mr-2" /> Contact
            </a>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openCartDrawer}
              aria-label={
                cartCount > 0
                  ? `Cart — ${cartCount} item${cartCount === 1 ? "" : "s"}`
                  : "Cart"
              }
              aria-haspopup="dialog"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition hover:bg-gray-100 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <FontAwesomeIcon icon={faShoppingCart} className="text-lg" />
              {cartCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[10px] font-bold leading-none text-white"
                >
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              ) : null}
            </button>
            <Link
              href="/login"
              className="primary-gradient text-white px-4 py-2 rounded-full font-semibold hover-lift pulse-glow inline-flex items-center"
              id="getStartedBtn"
            >
              <FontAwesomeIcon icon={faRocket} className="mr-2" />
              Get
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
