import { useEffect, useState } from 'react'
import { useStore } from '../store/store'

/** 持久化数据是否已从 IndexedDB 读回；读回前不渲染依赖资料的页面，避免闪现种子数据 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated())
  useEffect(() => {
    const off = useStore.persist.onFinishHydration(() => setHydrated(true))
    setHydrated(useStore.persist.hasHydrated())
    return off
  }, [])
  return hydrated
}
