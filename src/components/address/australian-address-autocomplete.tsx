"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { AustralianAddress } from "@/lib/address/parse"

type Suggestion = {
  id: string
  label: string
  source: "google" | "nominatim"
  address?: AustralianAddress
}

type AustralianAddressAutocompleteProps = {
  label?: string
  value: string
  onChange: (value: string) => void
  onAddressSelect: (address: AustralianAddress) => void
  placeholder?: string
  id?: string
  disabled?: boolean
}

export const AustralianAddressAutocomplete = ({
  label = "Address",
  value,
  onChange,
  onAddressSelect,
  placeholder = "Start typing your Australian address...",
  id: idProp,
  disabled = false,
}: AustralianAddressAutocompleteProps) => {
  const generatedId = useId()
  const inputId = idProp ?? generatedId
  const listboxId = `${inputId}-listbox`

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [hasSearched, setHasSearched] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setSuggestions([])
      setIsOpen(false)
      setHasSearched(false)
      return
    }

    setIsLoading(true)
    setHasSearched(false)
    try {
      const res = await fetch(`/api/address/autocomplete?q=${encodeURIComponent(query)}`)
      if (!res.ok) {
        setSuggestions([])
        setIsOpen(false)
        setHasSearched(true)
        return
      }
      const data = await res.json()
      const nextSuggestions = (data.suggestions ?? []) as Suggestion[]
      setSuggestions(nextSuggestions)
      setIsOpen(nextSuggestions.length > 0)
      setHasSearched(true)
      setActiveIndex(-1)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleInputChange = (nextValue: string) => {
    onChange(nextValue)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(nextValue)
    }, 250)
  }

  const handleSelect = async (suggestion: Suggestion) => {
    setIsOpen(false)
    setSuggestions([])
    setHasSearched(false)

    if (suggestion.source === "nominatim" && suggestion.address) {
      onChange(suggestion.address.address_line1 || (suggestion.label.split(",")[0] ?? ""))
      onAddressSelect(suggestion.address)
      return
    }

    if (suggestion.source === "google") {
      onChange(suggestion.label.split(",")[0] ?? suggestion.label)
      const res = await fetch(
        `/api/address/autocomplete?placeId=${encodeURIComponent(suggestion.id)}`
      )
      if (res.ok) {
        const data = await res.json()
        if (data.address) {
          onAddressSelect(data.address as AustralianAddress)
          onChange((data.address as AustralianAddress).address_line1 || (suggestion.label.split(",")[0] ?? ""))
        }
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1) % suggestions.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1))
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[activeIndex])
    } else if (e.key === "Escape") {
      setIsOpen(false)
      setActiveIndex(-1)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div ref={containerRef} className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <Input
          id={inputId}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true)
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-label={label}
        />
        {isOpen && suggestions.length > 0 && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute top-full left-0 z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg"
          >
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.id}
                role="option"
                aria-selected={index === activeIndex}
                tabIndex={0}
                className={cn(
                  "cursor-pointer px-3 py-2 text-sm text-gray-900 hover:bg-blue-50",
                  index === activeIndex && "bg-blue-50"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(suggestion)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleSelect(suggestion)
                  }
                }}
              >
                {suggestion.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {isLoading && (
        <p className="text-xs text-gray-500" aria-live="polite">
          Searching Australian addresses...
        </p>
      )}
      {!isLoading && hasSearched && suggestions.length === 0 && value.trim().length >= 3 && (
        <p className="text-xs text-amber-600" role="status">
          No matching addresses found. Try adding suburb or postcode.
        </p>
      )}
      <p className="text-xs text-gray-500">Australian addresses only — type at least 3 characters</p>
    </div>
  )
}
