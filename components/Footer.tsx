export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-ps-navy/30 bg-ps-navy px-6 py-4 text-center text-xs leading-relaxed text-blue-100">
      © {year} PS Industries — Greater Noida Plant. All rights reserved.
    </footer>
  );
}
