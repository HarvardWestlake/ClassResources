import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import About from './pages/About'
import History from './history/History'
import AdminLayout from './admin/AdminLayout'
import AdminHome from './admin/AdminHome'
import StyleGuide from './admin/StyleGuide'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="about" element={<About />} />
      <Route path="history" element={<History />} />
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<AdminHome />} />
        <Route path="style-guide" element={<StyleGuide />} />
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
 
