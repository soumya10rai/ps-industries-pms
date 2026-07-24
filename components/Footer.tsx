export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto bg-ps-navy px-6 py-3 text-center text-xs text-blue-100">
      © {year} PS Industries — Greater Noida Plant. All rights reserved.
    </footer>
  );
}
